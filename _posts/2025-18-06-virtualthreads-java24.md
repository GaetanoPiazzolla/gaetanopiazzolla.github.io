---
title: Virtual Threads With Java 24 - Will it Scale?
image: /assets/threads.png
layout: post
date: 2025-06-18 17:00:00 +0100
categories:
  - Java
---


A deep dive into Java's virtual threads performance characteristics
and the hidden infrastructure challenges they expose.

## Introduction

[Java's virtual threads](https://blog.devgenius.io/java-virtual-threads-715c162c6c39), introduced as a preview feature in Java 19 and stabilized in Java 21, promise to revolutionize how we handle concurrent I/O operations. 
The marketing pitch is compelling: write thread-per-request code that scales to millions of concurrent operations without the memory overhead of platform threads.

But how do virtual threads perform in real-world applications? 

We conducted extensive performance testing comparing virtual threads against traditional platform threads using a typical Spring Boot 
web application with database operations. Our findings reveal both the promise and the pitfalls of this new concurrency model.

We already did something similar in a previous article [Spring Boot 3 with Java 19 Virtual Threads](https://blog.devgenius.io/spring-boot-3-with-java-19-virtual-threads-ca6a03bc511d).
Here we discovered that when introducing some "delay" in the connection between the database and the application, (which mimick more precisely a real production application)
the performance of virtual threads had a huge dump due to [synchronized code blocks](https://docs.oracle.com/javase/tutorial/essential/concurrency/locksync.html) present in various libraries.

In this article we will see if the promises of [Java 24 JEP 491](https://openjdk.org/jeps/491), which prevents virtual thread pinning, are really up to the expectations.

<div align="center">
    <img src="/assets/threads.png" style="content-visibility:auto" alt="Threads of wool" loading="lazy" decoding="async">
</div>

## Test Setup

Our test application was a simple Spring Boot REST API with typical CRUD operations:
- **GET /books** - Retrieve all books from database
- **POST /books** - Create a new book
- **POST /orders** - Create an order for a book

The complete testing framework is available in our [GitHub repository](https://github.com/GaetanoPiazzolla/spring-boot-virtual-threads-test), a
long with the [Spring Boot application under test](https://github.com/GaetanoPiazzolla/spring-boot-virtual-threads). 
This allows you to reproduce and extend these tests with your own configurations. 
We made it simple enough: you just need to edit [this docker-compose file](https://github.com/GaetanoPiazzolla/spring-boot-virtual-threads-test/blob/master/deployment/docker-compose.yaml#L63-L90) .

Test results will be available in the output of the K6 script nicely formatted, 
but also in a visual form thanks to an ad-hoc built grafana dashboard:

<div align="center">
    <img src="/assets/grafana_24.png" style="content-visibility:auto" alt="grafana Dashboard" loading="lazy" decoding="async">
</div>

### Test Configuration

We tested different combinations of:
- **Java versions**: 19 and 24
- **Spring Boot versions**: 3.3.12 and 3.5.0
- **Thread types**: Platform threads vs Virtual threads

We used K6 for load testing with three distinct scenarios:

### Test Scenarios
- **Test A**: 20 users, 50 DB connections
- **Test B**: 500 users, 20 DB connections  
- **Test C**: 1000 users, 20 DB connections

All tests simulated realistic network conditions with database latency and jitter.

## Results: Version Independence

Our [comprehensive testing](https://docs.google.com/spreadsheets/d/10hZbWEWX9gv0B_C6QpnbkbZwW517sMBfzATrdu-9YUg/edit?usp=sharing) across different Java and Spring Boot versions revealed a surprising finding: **neither the Java version nor the Spring Boot version significantly impacts the performance of virtual or platform threads**.

### Test A: Low Concurrency (20 users, 50 DB connections)

| Java Version | Spring Boot Version | Platform Threads (req/s) | Virtual Threads (req/s) | Difference |
|--------------|---------------------|---------------------------|-------------------------|------------|
| 19           | 3.3.12              | 125.81                   | 123.83                  | -1.6%      |
| 19           | 3.5.0               | 124.83                   | 125.32                  | +0.4%      |
| 24           | 3.5.0               | 125.45                   | 125.38                  | -0.1%      |

**Key Finding**: At low concurrency levels, performance is virtually identical across all version combinations and thread types.

### Test B: Moderate Concurrency (500 users, 20 DB connections)

| Java Version | Spring Boot Version | Platform Threads (req/s) | Virtual Threads (req/s) | Error Rate (Virtual) |
|--------------|---------------------|---------------------------|-------------------------|---------------------|
| 19           | 3.3.12              | 71.59                    | 71.52                   | 0.55%               |
| 19           | 3.5.0               | 61.79                    | 62.94                   | 0.68%               |
| 24           | 3.5.0               | 61.43                    | 64.32                   | 0.65%               |

**Key Finding**: Even under moderate load, version differences are minimal. Virtual threads show slight performance variations but no clear version-based pattern.

### Test C: High Concurrency (1000 users, 20 DB connections)

| Java Version | Spring Boot Version | Platform Threads (req/s) | Virtual Threads (req/s) | Virtual Thread Error Rate |
|--------------|---------------------|---------------------------|-------------------------|---------------------------|
| 19           | 3.3.12              | 61.07                    | 88.04                   | 23.93%                    |
| 19           | 3.5.0               | 49.92                    | 85.19                   | 29.94%                    |
| 24           | 3.5.0               | 49.01                    | 87.11                   | 28.76%                    |

**Key Finding**: Under extreme concurrency, we have a significantly higher error rates (23-30%) with Virtual Threads regardless of Java or Spring Boot version.

## Java 24 and JEP 491: No Observable Impact

Despite testing Java 24 with JEP 491 (which prevents virtual thread pinning on synchronized blocks), we observed no meaningful performance improvements compared to Java 19. This suggests that:

1. **The bottleneck isn't pinning**: In our database-heavy workload, synchronized block pinning wasn't the primary performance constraint
2. **Infrastructure limitations dominate**: Connection pool behavior and database I/O characteristics overshadow JVM-level optimizations
3. **Real-world complexity**: Production applications face bottlenecks that aren't addressed by pinning prevention alone

## The Hidden Problem: ThreadLocal and Connection Pooling

Our investigation revealed a critical issue that explains both the performance gains and the increased error rates. The problem lies in how connection pools like HikariCP interact with virtual threads.

### The ThreadLocal Anti-Pattern

HikariCP uses ThreadLocal variables to cache database connections for thread reuse, as detailed in their [ConcurrentBag implementation](https://github.com/brettwooldridge/HikariCP/blob/4f732c301556424bc4b80a8ef363fc5bb0c387ca/src/main/java/com/zaxxer/hikari/util/ConcurrentBag.java):

```java
// HikariCP's ConcurrentBag implementation
private final ThreadLocal<List<Object>> threadList = new ThreadLocal<>();
```

This works perfectly with platform threads:
1. Request arrives → Platform thread handles it
2. Connection retrieved from ThreadLocal cache (or pool if first time)
3. Request completed → Thread returns to pool
4. Next request → Same thread reuses cached connection

With virtual threads, this breaks down:
1. Request arrives → New virtual thread created
2. ThreadLocal is empty → Must fetch from connection pool
3. Request completed → Virtual thread destroyed
4. Next request → New virtual thread, process repeats
5. **Zero connection reuse, maximum pool pressure**

### The Synchronized Bottleneck

HikariCP's connection retrieval uses synchronized blocks, as seen in their [HikariDataSource implementation](https://github.com/brettwooldridge/HikariCP/blob/4f732c301556424bc4b80a8ef363fc5bb0c387ca/src/main/java/com/zaxxer/hikari/HikariDataSource.java):

```java
public Connection getConnection() throws SQLException {
    return getConnection(connectionTimeout);
}

public Connection getConnection(long hardTimeout) throws SQLException {
    suspendResumeLock.acquire();
    // ... synchronized access to connection pool
}
```

Virtual threads hitting synchronized blocks get "pinned" to their carrier platform thread, eliminating the benefit of virtual thread scheduling. As documented in the [Oracle Virtual Threads documentation](https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html#GUID-DC4306FC-D6C1-4BCC-AECE-48C32C1A8DAA): *"A virtual thread cannot be unmounted during blocking operations when it is pinned to its carrier thread."*

The HikariCP team recognized this issue and attempted to address it with [Pull Request #2055](https://github.com/brettwooldridge/HikariCP/pull/2055), which aimed to replace synchronized blocks with ReentrantLocks. However, this PR was closed as the team decided to wait for Java 24's JEP 491 to resolve the pinning issue.

## Real-World Production Issues

We experienced this problem in production with the error message:
```
HikariPool-1 - Connection is not available, request timed out after 33473ms
```

Despite having adequate database connections for our load, virtual threads were:
1. Unable to reuse connections due to ThreadLocal behavior
2. Getting pinned on synchronized blocks during connection acquisition
3. Creating artificial connection scarcity
4. Causing cascading timeout failures

## Java 24 and JEP 491: Not a Silver Bullet With HikariCP

Java 24 includes JEP 491, which prevents virtual thread pinning on synchronized blocks. We tested this expecting it to solve our issues, but saw no meaningful improvement.

**Why JEP 491 didn't help:**
- The fundamental ThreadLocal problem remains
- Connection reuse is still broken
- Pool pressure is still maximized
- The synchronized block optimization is secondary to the caching issue

## The Bigger Picture

Virtual threads represent a paradigm shift in Java concurrency, but they're not a drop-in replacement for platform threads. They expose assumptions built into existing infrastructure that were optimized for thread pooling models.

The real value of virtual threads isn't just performance—it's simplicity. They allow developers to write straightforward, blocking I/O code that scales. But this simplicity comes with the responsibility to understand and adapt the entire application stack.

## Conclusion

Our testing revealed that virtual threads are neither the silver bullet they're marketed as, nor the complex solution they're sometimes portrayed to be. They're a tool that excels in specific scenarios—primarily extreme concurrency with I/O-bound operations.

**Key takeaways from our version testing:**
- Java version (19 vs 24) has minimal impact on virtual thread performance
- Spring Boot version (3.3.12 vs 3.5.0) shows no significant performance differences
- JEP 491 in Java 24 doesn't resolve the fundamental connection pooling issues

For most Spring Boot applications handling typical web traffic, the performance difference is negligible. The decision to adopt virtual threads should be based on specific scalability requirements, not general performance assumptions or version considerations.

Most importantly, virtual threads expose hidden assumptions in existing infrastructure. Success with virtual threads requires understanding and adapting connection pools, transaction management, and monitoring strategies to work with their unique characteristics.

The future of Java concurrency is bright, but it requires thoughtful adoption, not wholesale replacement.

## Further work

In the next articles:

- we'll try to FORK hikariCP to provide a different implementation of the ConcurrentBag
- we'll set up the connection parameters of Hikari CP as the connection timeout in order to achieve the maximum performance with a prefixed number of connection pool
- we'll use and test an HikariCP alternative, built by the Red Hat / Quarkus team, which is Loom-friendly (designed with support for virtual threads in mind): [Agroal](https://github.com/agroal/agroal).
- we'll test a new workload that involves also different scenarios than database queries, as calls to external services

---

*This analysis was conducted using Spring Boot 3.3.1 and 3.5.0 with Java 19 and 24, using K6 for load testing and PostgreSQL for database operations. The complete testing framework and application code are available on [GitHub](https://github.com/GaetanoPiazzolla/spring-boot-virtual-threads-test).*