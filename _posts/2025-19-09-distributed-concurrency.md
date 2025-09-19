---
title: Building Distributed Concurrency Control in Spring
excerpt: How to protect scarce resources by making limits consistent in distributed apps.
image: /assets/foresta-umbra.jpg
layout: post
date: 2025-09-19 16:00:00 +0100
categories:
- Java
---

In this article we'll build on the latest annotations introduced by Spring in the latest release making the implementation ready for distributed applications. 

Full code of this implementation is available [here](https://github.com/GaetanoPiazzolla/distributed-concurrency-limit).


<div class="post-image-container">
    <img src="/assets/foresta-umbra.jpg" class="post-image" alt="Foresta Umbra - Gargano" loading="lazy" decoding="async">
    <p class="post-image-subtitle">Foresta Umbra - April 2024</p>
</div>

### 1. Introduction: Spring 7.0's New Resilience Features
[Spring 7.0](https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-7.0-Release-Notes) 
introduced new resilience features for common tasks. 
One of these simplify concurrency throttling in spring with the new [@ConcurrencyLimit](https://docs.spring.io/spring-framework/docs/7.0.0-M7/javadoc-api/org/springframework/resilience/annotation/ConcurrencyLimit.html)
annotation.  This allows us to easily restrict the number of concurrent accesses to a specific resource:

```java  
@ConcurrencyLimit(10)
public String sendMessage(String message) { 
	return this.openApiClient.chat(message);
}
```

In a vanilla Java implementation, the equivalent idea would be using a **`Semaphore`** to control access:

```java
private final Semaphore semaphore = new Semaphore(10);
public String sendMessage(String message) {
    try {
        semaphore.acquire(); 
        return this.openApiClient.chat(message);
    } 
    //...
}
```

### 2. The Problem: Pod-Scoped Concurrency Limits
When scaling horizontally increasing the number of pods this limit does not work anymore 
(with **N** pods = **N x 10** concurrent requests). 
This can overload the downstream, increase costs, and risk cascading failures if not managed at the system level.

<div class="post-image-container">
    <img src="/assets/concurrency-limit.png" class="post-image" alt="Concurrency Limit on Multiple Instances" loading="lazy" decoding="async">
    <p class="post-image-subtitle">Concurrency Limit on Multiple Instances</p>
</div>

### 3. The Solution: Distributed Concurrency Control
To solve this problem, several architectural solutions are possible. 
In this case, we will build on Spring’s `@ConcurrencyLimit`, using a distributed semaphore 
that stores its internal state in Redis.

<div class="post-image-container">
    <img src="/assets/distributed-concurrency-limit.png" class="post-image" alt="Distributed Concurrency Limit" loading="lazy" decoding="async">
    <p class="post-image-subtitle">Distributed Concurrency Limit</p>
</div>

We’ll create a new annotation, `@DistributedConcurrencyLimit`, which enforces a maximum number of accesses to the external resource across multiple pods or even different applications—without requiring an additional load balancer or proxy layer in between.

```java  
@DistributedConcurrencyLimit(value = 10, identifier = "open-api-chat", timeout = 4000)
public String sendMessage(String message) { 
	return this.openApiClient.chat(message);
}
```

### 4. Implementation Deep Dive

#### Dependencies & Why Redisson

We use Redisson because it provides ready-made distributed data structures, 
including [RSemaphore](https://www.javadoc.io/doc/org.redisson/redisson/3.5.6/org/redisson/api/RSemaphore.html) - a distributed semaphore that handles the complexity of coordinating permits across multiple Redis clients.

```gradle
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-aop'
    implementation 'org.redisson:redisson-spring-boot-starter:3.51.0'
}
```

#### The Annotation

Our `@DistributedConcurrencyLimit` annotation defines three key parameters:

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface DistributedConcurrencyLimit {
    int value();                    // Max concurrent executions
    String identifier();            // Unique semaphore key
    long timeout() default 5000;    // Wait timeout in ms
}
```

#### Configuration

Enable the feature and configure Redis connection:

```yaml
distributed-concurrency:
  enabled: true

spring:
  data:
    redis:
      host: localhost
      port: 6379
```

#### The AOP Interceptor

The core logic uses Spring AOP to intercept annotated methods:

```java
@Component
@Aspect
@ConditionalOnProperty(name = "distributed-concurrency.enabled")
public class DistributedConcurrencyLimitInterceptor {
    
    private final RedissonClient redisson;
    private final Map<String, RSemaphore> semaphores = new ConcurrentHashMap<>();

    @Around("@annotation(concurrencyLimit)")
    public Object intercept(ProceedingJoinPoint joinPoint, 
                           DistributedConcurrencyLimit concurrencyLimit) throws Throwable {
        
        String identifier = concurrencyLimit.identifier();
        RSemaphore semaphore = getOrCreateSemaphore(identifier, concurrencyLimit.value());
        
        boolean acquired = semaphore.tryAcquire(Duration.ofMillis(concurrencyLimit.timeout()));
        if (!acquired) {
            throw new ConcurrencyLimitExceededException(/*...*/);
        }
        
        try {
            return joinPoint.proceed();
        } finally {
            semaphore.release();
        }
    }

    private RSemaphore getOrCreateSemaphore(String identifier, int maxPermits) {
        return semaphores.computeIfAbsent(identifier, key -> {
            RSemaphore semaphore = redisson.getSemaphore(key);
            boolean wasSet = semaphore.trySetPermits(maxPermits);
            if (wasSet) {
                log.info("Initialized distributed semaphore '{}' with {} permits", key, maxPermits);
            } else {
                log.debug("Semaphore '{}' was already initialized by another instance", key);
            }
            return semaphore;
        });
    }
}
```

The `getOrCreateSemaphore` method implements a two-level caching strategy:
1. **Local cache**: Uses `ConcurrentHashMap.computeIfAbsent()` to cache semaphore instances per JVM
2. **Distributed initialization**: Uses `trySetPermits()` 
which atomically sets permits only if the semaphore doesn't exist in Redis yet

This ensures thread-safety within each pod and safe initialization across multiple pods without race conditions.

### 5. Testing Distributed Concurrency Control

Testing distributed behavior requires simulating multiple application instances. We use [Testcontainers](https://testcontainers.com/) to spin up a real Redis instance and create separate Spring contexts to mimic different pods.

For a deeper dive into Testcontainers with Spring Boot, check out [this article](https://gaetanopiazzolla.github.io/java/docker/springboot/2023/05/27/springboot-tc.html).

#### Base Test Setup

```java
@SpringBootTest(classes = DistributedConcurrencyApp.class)
@Testcontainers
public abstract class AbstractRedisIntegrationTest {

    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7.2-alpine"))
            .withExposedPorts(6379)
            .withReuse(true);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        registry.add("distributed-concurrency.enabled", () -> "true");
    }
}
```

#### Testing Multiple Pods

The key insight is creating separate Spring application contexts to simulate different JVM instances:

```java
@Test
void shouldLimitConcurrencyAcrossMultiplePods() {
    final int numberOfPods = 3;
    final int requestsPerPod = 2;
    
    // Create separate Spring contexts to simulate different pods
    List<ApplicationContext> podContexts = new ArrayList<>();
    List<ResourceService> podServices = new ArrayList<>();
    
    for (int i = 0; i < numberOfPods; i++) {
        AnnotationConfigApplicationContext podContext = new AnnotationConfigApplicationContext();
        podContext.register(DistributedConcurrencyApp.class);
        podContext.refresh();
        
        podServices.add(podContext.getBean(ResourceService.class));
        podContexts.add(podContext);
    }
    
    // Execute concurrent requests from all "pods"
    List<CompletableFuture<Void>> futures = new ArrayList<>();
    AtomicInteger successfulExecutions = new AtomicInteger(0);
    AtomicInteger failedExecutions = new AtomicInteger(0);
    
    for (int podIndex = 0; podIndex < numberOfPods; podIndex++) {
        final ResourceService podService = podServices.get(podIndex);
        
        for (int requestIndex = 0; requestIndex < requestsPerPod; requestIndex++) {
            futures.add(CompletableFuture.runAsync(() -> {
                try {
                    podService.useLimitedResource("request-" + System.nanoTime());
                    successfulExecutions.incrementAndGet();
                } catch (ConcurrencyLimitExceededException e) {
                    failedExecutions.incrementAndGet();
                }
            }));
        }
    }
    
    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    
    // Verify that concurrency limits work across all pods
    assertTrue(failedExecutions.get() > 0, "Some requests should fail due to distributed limits");
    assertTrue(successfulExecutions.get() > 0, "Some requests should succeed");
}
```

This test validates that the distributed semaphore correctly limits concurrent access across multiple simulated application instances, proving our implementation works in a real distributed scenario.

### 6. Conclusion & Next Steps

This distributed concurrency control pattern shines when you need fine-grained resource protection across multiple application instances. 
However, consider alternative patterns when:
- **Load balancer limits suffice**: If your infrastructure already handles rate limiting effectively
- **Single pod scenarios**: Where local semaphores are adequate
- **Ultra-low latency requirements**: The Redis round-trip adds some overhead per operation

As next steps we could consider:
- **Dynamic permit adjustment**: Allow runtime modification of semaphore limits
- **Metrics integration**: Add Micrometer metrics for permit usage and wait times
- **Circuit breaker integration**: Combine with resilience patterns for robust failure handling
- **Rate limiting**: Extend the annotation to support time-based limits (requests per second)

The complete implementation with tests and examples is available on [GitHub](https://github.com/GaetanoPiazzolla/distributed-concurrency-limit).

As always, thank you for reading!
