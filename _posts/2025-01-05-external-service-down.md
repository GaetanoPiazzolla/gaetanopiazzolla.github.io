---
title: "Don't Let a Broken API Take Down Your Spring Boot App"
image: /assets/fuse-breaker.png
date:   2025-05-03 17:00:00 +0100
excerpt: "In this tutorial, we’ll present some best practices for resilience when dealing with External APIs."
categories: Resilience
---


## 1. Introduction

The vast majority of applications need to interact with an API, in order to send emails, 
print PowerPoint, create documents, or (just to stay in today's trends), send messages to LLMs.

In this tutorial, we'll present some best practices for resilience when dealing with External APIs.
Most of the methodologies presented here are well known and familiar, such as the "reply" or "health checks," 
but some of them are not, such as the fuse-breaker + feature toggle. Let's start with the easy ones.

<div align="center">
    <img src="/assets/fuse-breaker.png" style="content-visibility:auto" alt="Fuse breaker" loading="lazy" decoding="async">
</div>
<p style="text-align:center; font-style: italic;">A fuse inside a circuit.</p>

## 2. Replay and Circuit Breaker

**Replay is nothing more than a fancy for-loop that retries an API call until the response is successful.
Circuit Breaker is a way of avoiding continuous calls to an external service that is not responding correctly.**

Both are fundamental to build a resilient API connection with external services.

Implementation in a Spring Boot App is straightforward. In most of my projects,
I usually choose to rely on the simple Spring-provided annotation, but it's possible for more advanced 
configurations to use [Resilience4J](https://resilience4j.readme.io/docs/getting-started). 
Most of the projects do not require that level of sophistication. 
Usually, the [spring-retry](https://docs.spring.io/spring-batch/docs/4.3.10/reference/html/retry.html) library 
is more than enough:

```groovy
implementation("org.springframework.retry:spring-retry:1.3.4")
```

This library provides both _@Retryable_ and the _@CircuitBreaker_ annotation. Usage is simple:

```java 
@Retryable(
    value = Exception.class,
    maxAttempts = 4,
    backoff = @org.springframework.retry.annotation.Backoff(delay = 500)
)
@CircuitBreaker(
    maxAttempts = 4,
    openTimeout = 5000,
    resetTimeout = 20000
)
public List<StockPriceDTO> fetchStockInfo(String symbol) {
    String url = String.format(STOCK_INFO_URL, symbol);
    ResponseEntity<List<StockPriceDTO>> response = restTemplate.exchange(
        url,
        HttpMethod.GET,
        null,
        new ParameterizedTypeReference<>() {}
    );
    return response.getBody();
}
```

Apart from the various parameters that we can configure, a really important point is 
the order of the annotations. If _@CircuitBreaker_ is placed before _@Retryable_ the behavior 
will be different; each retry will be considered as a part of the circuit.

The _@Recover_ Annotation is used for a method invocation that is a recovery handler:

```java
@Recover
public List<StockPriceDTO> recover(Exception ex, String symbol) {
    log.error("Failed to fetch stock info for {}", symbol, ex);
    throw new RuntimeException("Failed to fetch stock info after retries", ex);
}
```

## 3. Health Checks

Checking the status of the external API connection when the application starts and at regular intervals
can help us great time in improving resiliency. 
We'll be notified as soon as the external connection is not responding. 
With the Spring Boot actuator library, it's possible to define custom actuators:

```java
@Component
@Slf4j
public class ExternalServiceHealthIndicator implements HealthIndicator {
    
    ... 
    
    @Override
    public Health health() {
        RestTemplate restTemplate = new RestTemplate();
        try {
            String status = restTemplate.getForObject(EXTERNAL_SERVICE_HEALTH_STATUS_URL, String.class);
            if ("UP".equalsIgnoreCase(status)) {
                log.info("External Service up and running.");
                return Health.up().withDetail("External Service", "Available").build();
            } else {
                return Health.down().withDetail("External Service", "Status: " + status).build();
            }
        } catch (RestClientException | NullPointerException | IllegalArgumentException e) {
            return Health.down().withDetail("External Service", "Error: " + e.getMessage()).build();
        } catch (Exception e) {
            return Health.down().withDetail("External Service", "Unexpected error: " + e.getMessage()).build();
        }
    }

}
```

This is especially useful if the service is relying on the external API for core functionality, 
and it's tightly coupled with it. 
The _health()_ method will typically be executed by a Kubernetes probe regularly, which will notify the caller if
the external service is not reachable by returning a 5xx HTTP response code.

Frequently, it is enough to check if something is wrong in the configuration of the API stubs
(e.g., someone updated the ENV-var with the wrong URL). In that case, we can replace the health probe with a simple
_CommandLineRunner_ executed at application startup.

## 4. Timeouts and Connection Pooling

When configuring REST calls inside a Spring Boot application,
we need to configure timeouts and connection pooling as well.
There are various ways of calling a REST method. 
In this example, let's add to the Spring context a _RestTemplate_ bean configured properly:

```java
@Configuration
public class ResilienceConfig {

    @Bean
    public RestTemplate restTemplate() {

        // Create a connection manager with pooling
        PoolingHttpClientConnectionManager connectionManager = new PoolingHttpClientConnectionManager();
        connectionManager.setMaxTotal(50); // Max total connections
        connectionManager.setDefaultMaxPerRoute(20); // Max connections per route

        // Create the HttpClient with connection pooling
        CloseableHttpClient httpClient = HttpClients.custom()
            .setConnectionManager(connectionManager)
            .build();

        // Use HttpComponentsClientHttpRequestFactory instead of SimpleClientHttpRequestFactory
        HttpComponentsClientHttpRequestFactory factory = new HttpComponentsClientHttpRequestFactory(httpClient);
        factory.setConnectTimeout(3000); // in milliseconds
        factory.setReadTimeout(5000);
    }
}
```

If we don't provide connection pooling and timeouts explicitly, defaults will be used:
No connection pooling (i.e., each HTTP request opens a new connection), connectTimeout = 0 (infinite), 
readTimeout = 0 (infinite).
**Opening a new TCP connection for each request means A LOT of resources wasted in terms of network bandwidth 
and CPU cycles; Not having a timeout for read and connection means we could have thousands of clients (and threads)
waiting for a response.**

## 5. Fuse Breaker + Feature Toggle

A fuse is a device (present in Car electrical circuits) that protects the vehicle from over current.
**Once the fuse is broken, the feature related to it does not work anymore, 
and manual intervention is needed to replace it.**

We can apply the same concept to our application.
If an external service, notwithstanding the _Retries_ and the _Circuit_ opening several times, 
continues to have problems and respond with errors, we can disable the functionality until manual intervention.
It's different from the CircuitBreaker because it never reset: the circuit remains in a broken state.

The point behind this is: **do we really want the users to experience thousands of errors? 
Isn't it better to completely disable the feature?**

Let's think of a real case scenario. 
We have an application that is building a PowerPoint, 
calling an external API. The external APIs are broken. 
Maybe a misconfiguration by the caller, or a permanent outage. We can disable the feature flag and entirely 
hide the button in the application, showing a message to notify users that the feature is currently not working.

Let's create a simple annotation that will be used to implement this behavior:

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface FuseBreaker {
    int numberOfAggregatedFailures() default 5;
    String method() default "";  // Method name to be called when fuse is broken
}
```

The usage is pretty similar to the _@Retryable_ and _@CircuitBreaker_:

```java
@Retryable(
    ...
)
@CircuitBreaker(
    ...
)
@FuseBreaker(
    numberOfAggregatedFailures = 3,
    method = "fuseBreakNotifier")
public List<StockPriceDTO> fetchStockInfo(String symbol) {
    String url = String.format(STOCK_INFO_URL, symbol);
    ResponseEntity<List<StockPriceDTO>> response = restTemplate.exchange(
        url,
        HttpMethod.GET,
        null,
        new ParameterizedTypeReference<>() {}
    );
    return response.getBody();
}

public void fuseBreakNotifier() {
    log.error("Fuse is broken !");
    // - the service is down! stop calling it
    // - disable the feature flag
    // - monitor the error
}
```

Also in this case, the order of annotation is important: with the ordering in the code above, the aggregated failure number does not include the retries 
and the circuit breaker openings. Let's now implement the aspect around the annotated method:

```java
@Aspect
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
@Slf4j
public class FuseBreakerAspect {

    private static final Map<String, AtomicInteger> failureCounters = new ConcurrentHashMap<>();
    private static final Map<String, Boolean> permanentlyBroken = new ConcurrentHashMap<>();

    @Around("@annotation(fuseBreaker)")
    public Object handlePermanentBreaker(ProceedingJoinPoint joinPoint, FuseBreaker fuseBreaker) 
            throws Throwable {
            
        String methodKey = joinPoint.getSignature().toLongString();

        // Check if already broken
        if (Boolean.TRUE.equals(permanentlyBroken.get(methodKey))) {
            throw new FuseBreakerException("Method permanently 
                disabled after multiple failures");
        }

        try {
            Object returned = joinPoint.proceed();
            failureCounters.remove(methodKey);
            return returned;
        } catch (Exception e) {

            // Count the failure
            int failures = failureCounters.computeIfAbsent(methodKey,
                    k -> new AtomicInteger(0)).incrementAndGet();

            // Check threshold
            if (failures >= fuseBreaker.numberOfAggregatedFailures()) {
                permanentlyBroken.put(methodKey, true);
                // Execute callback method if specified
                String callbackMethodName = fuseBreaker.method();
                if (!callbackMethodName.isEmpty()) {
                    try {
                        Object target = joinPoint.getTarget();
                        Method callback = target.getClass()
                            .getDeclaredMethod(callbackMethodName);
                        callback.setAccessible(true);
                        callback.invoke(target);
                    } catch (Exception ex) {
                        log.error("Failed to execute fuse-breaker method", ex);
                        permanentlyBroken.put(methodKey, false);
                    }
                }
            }

            throw e;
        }
    }
}
```
Replacing the broken fuse is as simple as cleaning the value of the hashmap and restoring the feature flag.

**NOTE:** This implementation simply counts the number of failures, and if the number exceeds the configured value,
the circuit permanently opens. This is a configuration valid for a single instance: 
if our application is running on multiple PODs, we need to use an external storage (as Redis) to store the HashMap.

## 6. Conclusion and Code

As always, the code is available for you to read, criticize, blame, or copy-paste at: 

[https://github.com/GaetanoPiazzolla/reslient-fuse-breaker](https://github.com/GaetanoPiazzolla/reslient-fuse-breaker)

Thank you for your time!