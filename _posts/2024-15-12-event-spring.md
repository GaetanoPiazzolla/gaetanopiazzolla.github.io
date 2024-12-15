---
title: Event Notification Pattern with Spring Data
layout: post
date: 2024-12-15 17:00:00 +0100
categories:
  - Spring
  - Design Patterns
---

In This article, we will implement a simple [Event Notification Pattern](https://martinfowler.com/articles/201701-event-driven.html) using Spring Data.

When an entity is updated, removed, or persisted, an event is published to notify other systems of the change. 

We will also enhance the notification process by incorporating DTO objects, 
thereby eliminating the need to fetch updated data. 
This enhancement addresses one of the downsides of the **Event Notification Pattern** compared to **Event Sourcing**.

The full code of the application is available on [GitHub](https://github.com/GaetanoPiazzolla/spring-event-notification).

---

<div align="center">
    <img src="https://cdn-images-1.medium.com/v2/0*ZW7xuJSrQ9h-g9lT" style="content-visibility:auto" alt="Ceiling" loading="lazy" decoding="async">
</div>
<p style="text-align:center; font-style: italic;">Photo by <a href="https://unsplash.com/@maxlarochelle?utm_source=medium&utm_medium=referral">Max LaRochelle</a> on Unspash</p>

---

### 1- Entity Listeners
To start, we use _@EntityListeners_ to specify the listener class for an entity. Below is an example where the Book entity is annotated to listen to lifecycle events via the _BookEntityListener_ class:

```java
@Entity
@Table(name = "books")
@EntityListeners(BookEntityListener.class)
public class Book extends AbstractEntity {
   
   // fields
   
}
```

The listener class itself is a Spring bean, annotated with _@Component_. 
It can handle events for multiple entities and publish corresponding events using a uniform object structure.

```java
@Component
@RequiredArgsConstructor
public class BookEntityListener {
    private final ApplicationEventQueue applicationEventQueue;

    @PostUpdate
    public void postUpdate(AbstractEntity entity) {
        switch (entity) {
            case Book book -> publishBookEvent(book, OperationType.UPDATE);
            default ->
                    log.error(...)
        }
    }

    @PostRemove
    public void postRemove(AbstractEntity entity) {
        // ...
    }

    @PostPersist
    public void postPersist(AbstractEntity entity) {
        // ...
    }

    private void publishBookEvent(Book book, OperationType operationType) {
        DataChangeEvent entityUpdated =
                DataChangeEvent.builder()
                        .eventName("book")
                        .id(book.getId())
                        .operationType(operationType)
                        .databaseVersion(book.getDatabaseVersion())
                        .build();
        applicationEventQueue.enqueue(entityUpdated);
    }
}
```

---

### 2- The Event Queue
Instead of publishing events directly, we enqueue them for two key reasons:

1) **Filtering duplicate events within the same transaction**: 
Events acting on the same entity in a single transaction are filtered, 
ensuring only the last event is published. The @_Version_ field in the entity is helpful here.

2) **Publishing events after transaction commits**:
Events are published only after the transaction is successfully committed to the database. 
This avoids the risk of sending events for changes that might be rolled back.

The _ApplicationEventQueue_ class uses a _ThreadLocal_ to safely store events in the current thread.
    
```java
@Component
@Getter
@Setter
@Slf4j
public class ApplicationEventQueue {

    private static final ThreadLocal<Set<DataChangeEvent>> events =
            ThreadLocal.withInitial(HashSet::new);

    public void enqueue(DataChangeEvent event) {
        events.get().add(event);
    }

    public void clear() {
        events.remove();
    }

    public Set<DataChangeEvent> consumeEvents() {
        Set<DataChangeEvent> allEvents = filterByLatestDatabaseVersion(events.get());
        this.clear();
        return allEvents;
    }

    private Set<DataChangeEvent> filterByLatestDatabaseVersion(
            Set<DataChangeEvent> dataChangeEventSet) {
        // return events filtered;
    }

}
```
While a @_RequestScope_ bean could work, it falls short when events are created outside the request scope, 
such as in @_Async_ methods. ThreadLocal provides a thread-safe alternative, but it requires careful management. 
Specifically, we must clear the stored events after they’re processed to avoid leaking events between requests.

Furthermore, oracle’s recommendation against pooling virtual threads makes _ThreadLocal_ a safe choice 
when using lightweight virtual threads. For details, 
see [Oracle’s documentation on DONT POOL VIRTUAL THREADS](https://docs.oracle.com/en/java/javase/20/core/virtual-threads.html#GUID-9065C2D5-9006-4F1A-93E0-D5153BB40475).

### 3- ThreadLocal Clearing Interceptor
To prevent event leakage when pooling threads, we clear the _ThreadLocal_ after requests are completed. This can be done using an interceptor:

```java
@RequiredArgsConstructor
@Slf4j
public class ThreadLocalClearingInterceptor implements HandlerInterceptor {

    private final ApplicationEventQueue applicationEventQueue;

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception ex) {
        log.trace("Clearing thread local request events");
        applicationEventQueue.clear(); // Clear ThreadLocal events after request completion
    }
}
```

Register the interceptor in the _WebMvcConfigurer_:

```java
@Configuration
@RequiredArgsConstructor
@Slf4j
public class WebConfig implements WebMvcConfigurer {

    private final ApplicationEventQueue applicationEventQueue;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        log.debug("WebConfig::addInterceptors()");
        registry.addInterceptor(new ThreadLocalClearingInterceptor(applicationEventQueue));
    }
}
```

### 4- Event Notification with Transaction Synchronization

The TransactionSynchronizationAspect ensures that events are sent only after the transaction is committed. 
The synchronization logic avoids sending events for failed transactions.

This aspect operates around all methods annotated with @Transactional, 
including those within classes annotated with @Transactional. 
The aspect registers event notifications immediately after the transaction commits. 
A new synchronization is registered for every transaction.

```java
@Aspect
@Component
@ConditionalOnProperty(value = "events.notification-enabled", havingValue = "true")
public class TransactionSynchronizationAspect {

    private final ApplicationEventQueue applicationEventQueue;
    private final ApplicationEventPublisher springEventPublisher;

    @Before(
            "execution(* (@org.springframework.transaction.annotation.Transactional *).*(..)) || "
                    + "@annotation(org.springframework.transaction.annotation.Transactional)")
    public void beforeWriteEndpoint(JoinPoint joinPoint) throws Throwable {
        if (isReadOnlyTransaction(joinPoint)) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        boolean alreadyRegistered =
                TransactionSynchronizationManager.getSynchronizations().stream()
                        .anyMatch(DataChangeEventSynchronization.class::isInstance);
        if (alreadyRegistered) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(
                new DataChangeEventSynchronization());
    }

    private boolean isReadOnlyTransaction(JoinPoint joinPoint) throws NoSuchMethodException {
        Method method = getTargetMethod(joinPoint);
        Transactional transactional = method.getAnnotation(Transactional.class);
        if (transactional == null) {
            transactional = joinPoint.getTarget().getClass().getAnnotation(Transactional.class);
        }
        return transactional != null && transactional.readOnly();
    }

    private Method getTargetMethod(JoinPoint joinPoint) throws NoSuchMethodException {
        Method signatureMethod = ((MethodSignature) joinPoint.getSignature()).getMethod();
        return joinPoint
                .getTarget()
                .getClass()
                .getMethod(signatureMethod.getName(), signatureMethod.getParameterTypes());
    }

    private class DataChangeEventSynchronization implements TransactionSynchronization {

        private void publishEvents() {
            Set<DataChangeEvent> eventsToPublish = applicationEventQueue.consumeEvents();
            if (CollectionUtils.isEmpty(eventsToPublish)) {
                return;
            }
            for (DataChangeEvent event : eventsToPublish) {
                springEventPublisher.publishEvent(event);
            }
        }

        @Override
        public void afterCommit() {
            publishEvents();
        }
    }
}
```

Since the aspect executes after the transaction commits, it ensures events are only sent if the transaction is successful. 
In case of a failure, events are not sent, and changes are rolled back.ù

### 5- Event Notification with DTO Response

This enhancement is implemented with a _ResponseBodyAdvice_, which intercepts the response body before it’s sent to the client.
Since events are sent after the transaction commits, data is guaranteed to be persisted in the database.

```java
@ControllerAdvice
@RequiredArgsConstructor
@ConditionalOnProperty(value = "events.notification-response-enabled", havingValue = "true")
public class EventNotificationResponseBodyAdvice implements ResponseBodyAdvice<Object> {

    private final ApplicationEventQueue applicationEventQueue;
    private final ApplicationEventPublisher springEventPublisher;

    @Override
    public boolean supports(
            MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(
            Object body,
            MethodParameter returnType,
            MediaType selectedContentType,
            Class<? extends HttpMessageConverter<?>> selectedConverterType,
            ServerHttpRequest request,
            ServerHttpResponse response) {

        if (isWriteMethod(request.getMethod())) {
            try {
                this.publishEvents(body);
            } catch (Exception e) {
                log.error("Error while sending spring events", e);
            }
        }

        return body;
    }

    private void publishEvents(Object body) {

        Set<DataChangeEvent> eventsToPublish = applicationEventQueue.consumeEvents();
        if (eventsToPublish.isEmpty()) {
            return;
        }
        for (DataChangeEvent event : eventsToPublish) {
            event.setBody(body);
            springEventPublisher.publishEvent(event);
        }
    }
}
```

### 6- Consuming Events
The DataChangeEvent events can be consumed using the @EventListener annotation.
By adding @Async, the event listener runs asynchronously, avoiding blocking the main thread.

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class UpdateEventListener {

    @Async
    @EventListener
    public void on(DataChangeEvent event) {
        // do something with the event, e.g. update a cache, use a message broker, etc.
    }
}
```
Once the event is consumed, it can trigger a wide range of actions tailored to the application's requirements.

Furthermore, Spring Modulith offers a seamless way to externalize events.
To learn more about externalizing events with Spring Modulith, 
Check [Simplified Event Externalization with Spring Modulith](https://spring.io/blog/2023/09/22/simplified-event-externalization-with-spring-modulith) for more details.

### 7- Alternatives and Conclusions

[Debezium](https://debezium.io/) is an open-source platform that implements the Change Data Capture (CDC) pattern, 
capturing real-time changes directly from database transaction logs. Debezium enables "easy" event-driven architectures.

Thank you very much for reading. I hope you found this article helpful.
Check out the complete application on [GitHub](https://github.com/GaetanoPiazzolla/spring-event-notification).
If you have any questions or suggestions, feel free to reach out to me.