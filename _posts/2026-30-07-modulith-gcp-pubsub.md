---
title: "Externalizing Domain Events to GCP Pub/Sub with Spring Modulith"
layout: post
date: 2026-07-30 13:00:00 +0100
image: /assets/trapani-sicily.jpg
excerpt: A beach read - How to leverage the power of Spring Modulith events management with GCP pub-sub
categories:
- Spring
- GCP
---

Spring Modulith is Spring's toolkit for the modular monolith: one deployable application, split into modules whose boundaries are verified by tests, where modules talk to each other by publishing domain events instead of calling each other's classes directly. One of its standout features is the built-in transactional outbox pattern, which ensures domain events are reliably published alongside your business transactions. Out of the box, Spring Modulith externalizes to Kafka, AMQP, JMS, and Spring's own `MessageChannel` abstraction.

But what if your infrastructure runs entirely on Google Cloud, and you need to externalize these events to GCP Pub/Sub? There is no Pub/Sub externalizer, so you have to wire it up yourself.

{% include image.html src="/assets/trapani-sicily.jpg" alt="Trapani - Sicily - I'm pretty sure she is not reading about Spring or GCP." %}

In this article we will walk through a complete, production-ready implementation journey. We'll start by establishing a solid architectural foundation, move on to safely producing and consuming events, and finally harden the system with advanced Pub/Sub features like dead-letter queues, message ordering, and local emulator testing.

*(Note: This guide uses Spring Boot 4.1, Spring Modulith 2.1, and Spring Cloud GCP 8.1. Every example is from a working repository, and almost all of it runs against the local Pub/Sub emulator—no real GCP project required.)*

Repository with full code is here: https://github.com/GaetanoPiazzolla/modulith-gcp-pubsub

## Part 1: The Foundation

Before we write any code, we need to understand exactly what problem we are trying to solve and how our application will be structured to solve it.

### Understanding the Dual-Write Problem

Imagine a typical e-commerce scenario: a user places an order. Your application needs to do two things atomically:
1. Save the new order to the database.
2. Publish an `OrderCompleted` event to notify downstream services (like Shipping or Billing).

If you commit the database transaction and *then* publish the event, a sudden crash right after the commit means the event is lost forever. Conversely, if you publish the event and *then* commit, a database rollback will result in a phantom event being sent downstream. This is known as the dual-write problem.

The **transactional outbox pattern** solves this elegantly. Instead of sending the event directly to the broker, you save the event to an outbox table within the *same* database transaction as the business entity. A separate step then reads from this outbox and forwards the messages to the broker. If the process crashes, it simply retries unsent messages upon restart.

What that buys you is **at-least-once delivery**: no event is ever lost, but a consumer can see the same event more than once — a crash between "message sent" and "row marked complete" means the retry sends it again. Part 3 deals with the duplicates that follow.

Spring Modulith provides this functionality out of the box via its event publication registry. It saves externalized events to an `event_publication` table, forwards them once the transaction commits, tracks their completion, and automatically replays incomplete rows on startup. Our job is simply to provide the Pub/Sub glue to transport those saved events.

### Pub/Sub in Sixty Seconds

If Pub/Sub itself is new to you, three terms carry most of this article:

- A **topic** is a named channel you publish messages to. It knows nothing about who is listening.
- A **subscription** attaches to a topic and receives everything published after it was created. Each subscription gets its own copy of every message, so two services can both read the same topic without stealing messages from each other. Messages wait in the subscription until they are acknowledged, or until its retention window expires — seven days by default, configurable from ten minutes up to 31 days.
- **Ack** and **nack** are how a consumer answers. An *ack* ("acknowledge") means "handled, you can forget it"; a *nack* means "I failed, send it to me again".

That topic/subscription split matters more than it first appears, because configuration lives on one side or the other: a schema belongs to the **topic**, while filtering, dead-lettering and delivery deadlines belong to the **subscription**. When you see `order-events` and `order-events-sub` below, the distinction is deliberate.

### High-Level Architecture

Let's visualize how an event flows through the system. When you publish an event in Spring Modulith, it routes the event down two distinct paths:

1. **In-process listeners**: Handled asynchronously within the same JVM.
2. **Externalized outbox**: Persisted to the database and eventually sent to Pub/Sub.

```text
┌────────────────────────────────────────────────────────────────┐
│                   Spring Boot Application                      │
│                                                                │
│  ┌──────────┐   ApplicationEvent    ┌────────────────────────┐ │
│  │  order   │ ─────────────────────>│      notification      │ │
│  │          │   OrderCompleted      │ in-process, async,     │ │
│  └──────────┘         │             │ NOT ordered            │ │
│                       ▼             └────────────────────────┘ │
│             ┌──────────────────┐                               │
│             │ Event Publication│  transactional outbox         │
│             │  Registry (H2)   │                               │
│             └────────┬─────────┘                               │
│                      │  Modulith maps OrderCompleted           │
│                      │  → OrderCompletedV1 here                │
│                      ▼                                         │
│           ┌────────────────────┐  serializes the payload,      │
│           │ PubSubEvent        │  sets ordering key,           │
│           │ Transport          │  resumes paused keys          │
│           └────────┬───────────┘                               │
└────────────────────┼───────────────────────────────────────────┘
                     ▼
             ┌──────────────┐        ┌──────────────────┐
             │ GCP Pub/Sub  │───────>│ order-events-dlq │
             │(order-events)│        └──────────────────┘
             └──────┬───────┘
                    │  per-customer ordering applies HERE only
                    ▼
        ┌─────────────────────────────────┐
        │            shipping             │
        │ pull subscriber / push endpoint │
        │ own contract, own dedupe        │
        └─────────────────────────────────┘
```

A crucial point to remember as we move forward: these two paths have **entirely different delivery semantics**. The in-process listener doesn't have an acknowledgment (ack/nack) concept or strict ordering. On the other hand, strict per-customer message ordering only applies to the events sent over the network to Pub/Sub.

### Strict Module Layout

To keep our application modular, we divide it into the following logical boundaries:

| Module | Role | Depends on |
|---|---|---|
| `order` | Owns and publishes the domain event | — |
| `notification` | Consumes it **in-process** | `order`, `shared` |
| `shipping` | Downstream service, consumes **over Pub/Sub** | `shared` |
| `shared` | Small shared utilities | — |
| `infrastructure` | The Pub/Sub transport and the contract mapping | `order` |

Notice that the `shipping` module does not depend on `order`, and that `infrastructure` does. Both are deliberate. A service reading from a message broker should depend on the message format (the public contract), not the producer's internal domain classes — whereas `infrastructure` is where `OrderCompleted` is translated into `OrderCompletedV1`, so it necessarily sees both.

This architectural boundary is strictly enforced in the codebase using a `package-info.java` file in the `shipping` package. If a developer accidentally imports an `order` class into `shipping`, Spring Modulith's architectural tests (`ModularityTests`) will rightfully fail the build:

```java
@org.springframework.modulith.ApplicationModule(allowedDependencies = "shared")
package gae.piaz.modulith.pubsub.shipping;
```

---

## Part 2: Producing Events

With our foundation set, let's look at how we get an event out of our domain logic and safely onto the GCP Pub/Sub broker.

### Publishing an Event

From the perspective of the `order` module, publishing an event is completely agnostic to Pub/Sub. You simply publish a standard Spring application event within your transaction:

```java
@Transactional
public UUID completeOrder(String customerId) {
    var orderId = UUID.randomUUID();
    events.publishEvent(new OrderCompleted(orderId, customerId));
    return orderId;
}
```

To tell Spring Modulith to externalize this event, we add the `@Externalized` annotation. The value specifies the target topic and an optional routing key using SpEL (Spring Expression Language):

```java
@Externalized("order-events::#{#this.customerId()}")
public record OrderCompleted(UUID orderId, String customerId) {}
```

Read that value as two halves separated by `::`. `order-events` is the topic. Everything after it is the **routing key** — a per-message label, which we will shortly map onto Pub/Sub's ordering key so that all events for one customer stay in sequence. Inside `#{...}`, `#this` refers to the event object being published, so `#this.customerId()` simply calls the record's accessor to pull the customer ID off it.

### Implementing the Pub/Sub Transport

Now we need to implement the actual bridge between the Spring Modulith outbox and GCP Pub/Sub. Modulith exposes an SPI for exactly this — a Service Provider Interface, meaning an interface the framework calls but expects *you* to supply the implementation for. `EventExternalizationTransport` has a single method, `externalize`, which takes the event payload, publishes the message, and returns a `CompletableFuture`.

If the future completes successfully, Modulith marks the outbox row as complete. If it fails, Modulith keeps the row and retries later.

```java
class PubSubEventTransport implements EventExternalizationTransport {

    @Override
    public CompletableFuture<?> externalize(Object payload, RoutingTarget target) {
        try {
            // target still carries the raw @Externalized SpEL
            var routing = BrokerRouting.of(target, evaluationContext);
            var topic = routing.getTarget(payload);
            var orderingKey = serializer.orderingKey(payload, routing);
            var ordered = orderingKey != null && !orderingKey.isBlank();

            var message = PubsubMessage.newBuilder()
                    .setData(ByteString.copyFrom(serializer.serialize(payload)))
                    .putAttributes("eventType", serializer.eventType(payload));

            if (ordered) {
                message.setOrderingKey(orderingKey);
            }

            var published = pubSub.publish(topic, message.build());

            if (!ordered) {
                return published;
            }

            // For ordered messages, we must explicitly handle failures
            return published.whenComplete((messageId, error) -> {
                if (error != null) {
                    resumeOrderingKey(topic, orderingKey);
                }
            });
        } catch (IOException | RuntimeException e) {
            // a failed publish leaves the publication incomplete, so it is resubmitted on restart
            return CompletableFuture.failedFuture(e);
        }
    }
}
```

Catching `RuntimeException` alongside `IOException` matters: a serialization bug should become a failed future so the publication stays incomplete, rather than escaping into the listener. And note *when* this method runs. The listener Modulith uses to call it composes `@Async`, `@Transactional(propagation = REQUIRES_NEW)` and `@TransactionalEventListener` — so it fires on a different thread, in its own transaction, and only *after* your business transaction has committed. The consequence: by the time a publish fails, the order is already saved and there is nothing left to roll back. The outbox row surviving the failure is the entire safety net.

To make the transport flexible, we extract serialization into a strategy interface (`PubSubEventSerializer`). This makes it trivial to swap between JSON and Avro formats later without rewriting the transport logic.

### Wiring the Transport In

There is one wiring step with no visible symptom when you skip it. Declaring an `EventExternalizationTransport` bean is not enough — nothing in Modulith's auto-configuration looks for one. `EventExternalizationAutoConfiguration` contributes exactly three beans, and none of them reference the transport SPI. The class that actually calls your transport is `EventExternalizerModuleListener`, and the official broker starters register it themselves. A hand-written transport has to do the same:

```java
@Bean
EventExternalizationTransport pubSubTransport(
        PubSubTemplate pubSub, PublisherFactory publishers, PubSubEventSerializer serializer) {
    return new PubSubEventTransport(pubSub, publishers, serializer);
}

@Bean
EventExternalizerModuleListener pubSubEventExternalizer(
        EventExternalizationConfiguration configuration, EventExternalizationTransport transport) {
    return new EventExternalizerModuleListener(configuration, transport);
}
```

Omit the second bean and the application starts cleanly, the `event_publication` table fills up, and not one message is ever published.

### Routing Keys and Message Ordering

The borrowed name is worth unpicking first, because it means something different here. In brokers like RabbitMQ, the publisher stamps a routing key and the exchange's bindings decide *which queue* the message lands in — routing is publisher-driven, per message. Pub/Sub inverts that: you publish to a topic, every subscription attached to it receives a copy, and nothing you put on the message changes that. Selectivity does exist, but it lives on the *subscription* as a filter over message attributes, owned by the consumer side rather than the producer (see [Message Filtering](#message-filtering)). Modulith's routing key maps onto neither of those. It becomes a Pub/Sub **ordering key**, a different axis entirely: it constrains a message's sequence relative to others sharing the same key, and has no bearing on where it is delivered.

And sequence is a real concern. Asynchronous messaging delivers as fast as it can across many parallel connections, so messages can genuinely arrive out of order: publish `OrderCompleted` and then `OrderCancelled` a second later, and a consumer can plausibly see the cancellation first and then "un-cancel" the order by processing the completion. An ordering key removes that class of bug for everything sharing the key.

Note that Modulith hands the annotation's value to the transport **unevaluated**. The `target` argument still contains the literal string `#{#this.customerId()}` — not `customer-123`. Turning one into the other is the transport's job, and `BrokerRouting` is the helper that does it:

```java
var routing = BrokerRouting.of(target, evaluationContext);
var orderingKey = routing.getKey(payload);   // "customer-123"
var topic = routing.getTarget(payload);      // "order-events"
```

Ordering applies *per key*, and that is the whole point. Two different customers' events still travel in parallel, while one customer's events queue behind each other. Ordering an entire topic would instead force every message through a single sequential lane. Choosing the key is therefore a throughput decision: pick the narrowest entity whose sequence you actually care about.

Just ensure ordering is enabled in your config:

```yaml
spring.cloud.gcp.pubsub.publisher.enable-message-ordering: true
```

*Note: ordering only holds within a single GCP region, and the default endpoint is global. So once you run more than one instance of your app, two instances can be served by two different regions, and Pub/Sub can no longer sequence their messages against each other. Pinning every publisher to the same regional endpoint (e.g. `europe-west1-pubsub.googleapis.com:443`) is what keeps a key on one lane.*

### The Paused-Key Trap

There is a major caveat to message ordering. If message #1 fails to publish, Pub/Sub intentionally **pauses the key** so that message #2 isn't accidentally published ahead of it.

When combined with the transactional outbox, this creates a dangerous trap. If the publish fails, Modulith will retry it later. But because the key is paused, the retry will instantly fail again. You end up in an infinite retry loop, permanently blocking that customer's events.

To fix this, our transport must explicitly resume the key whenever a failure occurs:

```java
private void resumeOrderingKey(String topic, String orderingKey) {
    try {
        publishers.createPublisher(topic).resumePublish(orderingKey);
    } catch (RuntimeException e) {
        log.warn("Could not resume ordering key {} on topic {}", orderingKey, topic, e);
    }
}
```

Two details in that snippet are deliberate. `whenComplete` observes the error without replacing it, so the original failure still propagates and Modulith still treats the publish as failed — resuming a key is not the same as delivering the message. And `resumePublish` isn't exposed on `PubSubTemplate`, so it's reached through `PublisherFactory`, which caches publishers per topic and therefore hands back the same instance the failed publish used.

### Internal Events vs. Public Contracts

Before we leave the producer side, there is one critical best practice. Publishing internal domain events straight to the broker makes every field of your domain class part of a public API: rename one, and downstream consumers break.

Instead, map your internal events to a stable, versioned public contract using Modulith's `EventExternalizationConfiguration`:

```java
@Bean
EventExternalizationConfiguration eventExternalizationConfiguration() {
    return EventExternalizationConfiguration.externalizing()
            .select(EventExternalizationConfiguration.annotatedAsExternalized())
            // internal domain event → versioned public contract
            .mapping(OrderCompleted.class, OrderCompletedV1::from)
            .build();
}
```

Treat that contract as append-only: add fields freely, but never rename or remove one. A topic has no compile-time link to its consumers, so the first sign that a field was still in use is someone else's failure, not yours.

There is also an ordering subtlety that is easy to trip over. Modulith runs this mapping **before** it evaluates the SpEL routing key, so by then the payload is an `OrderCompletedV1`, not an `OrderCompleted`. Your public contract therefore has to expose every field the `@Externalized` expression mentions — which is why `customerId` appears in it. In-process listeners are unaffected; they still receive the original domain event.

---

## Part 3: Consuming Events

Once the event is safely on the broker, we need to consume it. In an event-driven architecture, not all consumers play by the same rules.

### Two Consumers, Two Sets of Rules

In our example architecture, two different consumers handle the `OrderCompleted` event.

The `notification` module consumes the event **in-process** via an `@ApplicationModuleListener`. Meanwhile, the `shipping` module consumes it **over Pub/Sub**. They share the exact same domain event conceptually, but completely different operational semantics:

| Feature | In-Process Listener | Pub/Sub Subscriber |
|---|---|---|
| **Acknowledgment** | Returning normally completes it. | Explicit `ack()`, or HTTP `102`/`200`/`201`/`202`/`204`. |
| **Failure (Nack)** | Throwing an exception leaves it incomplete. | Explicit `nack()`, or any other status code. |
| **Redelivery** | Only on app restart, or an explicit resubmit. | Automatic — immediately on pull unless you set a retry policy; push always backs off. |
| **Ordering** | None. Handlers execute concurrently. | Strict per-key ordering (if configured). |

Two of those rows have real design consequences.

The first is ordering. In-process listeners run on a thread pool, concurrently, so they can finish in any order regardless of the ordering key you so carefully set — that key only means something to Pub/Sub subscribers. Order-sensitive logic has to live on the broker side.

The second is recovery time. A Pub/Sub subscriber that fails gets another attempt within seconds, automatically. An in-process listener that throws just leaves an incomplete row behind, and nothing retries it until the application restarts or someone triggers a resubmit (there's an example in Part 5). Same event, same codebase, recovery times measured in seconds versus days.

### Pull vs. Push Subscribers

Pub/Sub offers two distinct consumption models.

**Pull Subscribers** open a long-lived gRPC stream to the broker and let it push messages down that connection. Because your app dials out, it needs no public URL at all — which suits a service on an always-running VM or container inside a private network.

The catch is that you now own a background stream, and Spring needs to know when to open and close it. That is what `SmartLifecycle` is for: Spring calls `start()` once the application context is ready, and `stop()` during shutdown, which gives in-flight messages a chance to finish instead of being cut off mid-handler.

```java
@Component
@Profile("pull-subscriber")
public class OrderEventPullSubscriber implements SmartLifecycle {

    private static final long SHUTDOWN_TIMEOUT_SECONDS = 10;

    private volatile Subscriber subscriber;   // retained so stop() can close the stream

    @Override
    public void start() {
        subscriber = pubSubTemplate.subscribe(SUBSCRIPTION, this::handle);
    }

    @Override
    public void stop() {
        var current = subscriber;
        subscriber = null;
        if (current != null) {
            current.stopAsync();
            try {
                current.awaitTerminated(SHUTDOWN_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            } catch (TimeoutException e) {
                log.warn("Pull subscriber did not terminate within {}s", SHUTDOWN_TIMEOUT_SECONDS);
            }
        }
    }

    @Override
    public boolean isRunning() {
        return subscriber != null;
    }
}
```

**Push Subscribers** invert the direction: GCP makes an HTTP POST to a URL you register, and there is no stream to manage. That suits serverless platforms like Cloud Run, where a container may not even be running between requests and a long-lived pull stream is therefore a non-starter.

One detail matters before you write the handler: Pub/Sub does not POST your event as the request body. It POSTs an *envelope* describing the delivery, in which your payload sits Base64-encoded in a `message.data` field. Hence the two records below, and hence the decoding step in the next section.

```java
@RestController
@Profile("push-subscriber")
@RequestMapping("/api/v1/pubsub")
public class PubSubPushController {

    record PushEnvelope(PushMessage message, String subscription) {}
    record PushMessage(String data, Map<String, String> attributes, String messageId, String publishTime) {}

    @PostMapping("/push")
    public ResponseEntity<Void> handlePush(@RequestBody PushEnvelope envelope) {
        // ... handle the message payload ...
        return ResponseEntity.ok().build();
    }
}
```

Notice what the `shipping` module does *not* do here: it does not import the producer's `OrderCompletedV1`. It declares its own record holding only the fields it needs, and tells Jackson to ignore everything else (`@JsonIgnoreProperties(ignoreUnknown = true)`).

That is the **tolerant reader** pattern, and it is what makes the two services independently deployable. The producer adding a `discountCode` field becomes a non-event for shipping, rather than a deserialization failure at 3 a.m. A consumer reading from a topic depends on the *wire format*, not on the publisher's classes — and in this repository that rule is enforced by an architecture test, not by good intentions.

### Idempotent Consumers

**What is Idempotency?** An operation is idempotent if performing it multiple times yields the same result as performing it exactly once. In message-driven systems, this means a consumer must safely handle processing the exact same message twice without corrupting the state of the application.

Because we're operating with at-least-once delivery semantics, your consumers *will* eventually receive duplicate messages due to broker retries or application restarts. You must build idempotent consumers.

Which raises the question of what you remember them *by*. The obvious candidate is the broker's `messageId`, and it is the wrong one: Pub/Sub mints a fresh message ID on every publish, so when the outbox resubmits an event after a failed attempt, the duplicate arrives with a *different* ID and sails straight past the check. Dedupe on a stable business key instead — here `orderId`, which identifies the same order however many times it is sent.

This demo keeps those keys in a small bounded cache, which is honest about being a demo: it forgets everything on restart. In production that store belongs in the database, ideally as a unique constraint on the business key written in the same transaction as the work itself — so "have I seen this?" and "did I do the work?" can never disagree.

```java
@Component
public class OrderEventListener {

    private final ProcessedKeys<UUID> processed = new ProcessedKeys<>(10_000);

    @ApplicationModuleListener
    void on(OrderCompleted event) {
        if (!processed.firstOccurrence(event.orderId())) {
            log.info("Duplicate OrderCompleted ignored: orderId={}", event.orderId());
            return;
        }
        log.info("Received order completed event: orderId={}, customerId={}", event.orderId(), event.customerId());
    }
}
```

One more rule, easy to get wrong when you refactor: **every independent consumer needs its own idempotency store.** Share one cache between the email sender and the shipping processor, and whichever consumer sees the event first marks it as processed — so the other one silently skips work it genuinely needed to do. Deduplication answers "have *I* handled this?", which means the answer has to be per consumer.

### Handling Failures: Permanent vs. Transient

When using push subscriptions, Pub/Sub interprets your HTTP status code to determine delivery success. The ack set is exactly five codes — `102`, `200`, `201`, `202`, `204` — and **every other code is a nack**. Note that this is narrower than "any 2xx": a `206` is a nack despite being a success code.

That creates a subtle problem. A malformed JSON payload invites a `400 Bad Request`, but Pub/Sub reads that as a nack and keeps redelivering the same broken body for the subscription's whole retention window — seven days by default, and up to 31 if it was raised. There is no status code meaning "this message is broken, stop sending it".

So you have to make the distinction yourself, and the question to ask about any failure is simply: *would receiving this message again change the outcome?*

- **Permanent failures** — malformed JSON, an unknown event type, a validation rule the payload can never satisfy. Redelivery cannot help, so return `200 OK` to stop the retries. Be aware of what you are doing here: acking a message you did not process is a deliberate, silent data loss, so it belongs behind an `ERROR` log and an alert, not a quiet `catch`.
- **Transient failures** — a database timeout, a downstream service that is briefly down. Return a `5xx` so Pub/Sub backs off and tries again, since the next attempt genuinely might succeed.

```java
OrderCompletedMessage event;
try {
    var json = new String(Base64.getDecoder().decode(envelope.message().data()), StandardCharsets.UTF_8);
    event = objectMapper.readValue(json, OrderCompletedMessage.class);
} catch (IllegalArgumentException | JacksonException e) {
    // permanent: redelivery cannot help, so we ack it to stop the retries.
    log.error("Discarding unparseable push message id={}", envelope.message().messageId(), e);
    return ResponseEntity.ok().build();
}
```

---

## Part 4: Hardening for Production (Advanced Features)

At this point we have a system that reliably produces and consumes events. Surviving production is a different question, and it mostly comes down to four: how big are the messages, what happens to a message that can *never* succeed, how do you avoid paying to deliver events a consumer will only discard, and how do you recover once you discover you processed two days of events wrongly. Pub/Sub has a feature for each.

### Avro on the Wire

**What is Avro?** Apache Avro is a serialization format that writes data as compact binary rather than text, guided by a schema you declare up front in a `.avsc` file. Two things follow from that: messages are considerably smaller than the equivalent JSON, and the schema becomes an enforceable contract between producer and consumer instead of a shared assumption.

Pub/Sub leans into this by letting you attach the schema to the **topic** — a topic-side setting, as the vocabulary above would predict. It then validates every publish against it and rejects anything that doesn't conform, which means a malformed message is stopped at the broker rather than discovered downstream by a consumer that cannot parse it.

```bash
gcloud pubsub schemas create order-completed-schema \
  --type=AVRO --definition-file=src/main/avro/order_completed_v1.avsc

gcloud pubsub topics create order-events \
  --schema=order-completed-schema --message-encoding=BINARY
```

Switching to Avro in our architecture simply requires providing a new `PubSubEventSerializer` bean that maps the payload to an Avro-generated class:

```java
@Bean
PubSubEventSerializer avroEventSerializer() {
    return new PubSubEventSerializer() {
        @Override
        public byte[] serialize(Object payload) throws IOException {
            return serializeAvro((OrderCompletedV1Avro) payload);
        }
        @Override
        public String eventType(Object payload) {
            return ((OrderCompletedV1Avro) payload).getSchema().getName();
        }
        @Override
        public String orderingKey(Object payload, BrokerRouting routing) {
            // Avro generated types expose JavaBean getters, so #this.customerId() cannot evaluate
            return ((OrderCompletedV1Avro) payload).getCustomerId().toString();
        }
    };
}
```

That third method is the interesting one, and it explains why the strategy isn't just `serialize`. On the JSON path the ordering key comes from `routing.getKey(payload)`, which evaluates `#this.customerId()` against the mapped payload — and since `OrderCompletedV1` is a Java record, it really does have a `customerId()` accessor, so the expression resolves. Avro's code generator produces old-fashioned JavaBeans instead, exposing `getCustomerId()`. The identical expression now finds no such method and blows up at runtime, which is why the Avro serializer reads the key directly and skips SpEL entirely.

The general lesson outlives Avro: your routing expression is coupled to the shape of whatever the *mapping* produces, even though you wrote it on the domain event.

One operational caveat: a topic carries at most one schema, so the Avro topic and the default JSON profile are mutually exclusive. Point a JSON publisher at an Avro topic and every publish is rejected — and because externalization is asynchronous, that surfaces as a climbing `modulith.events.incomplete` gauge, not a failed request.

### Dead Letter Queues (DLQs)

**What is a DLQ?** A Dead Letter Queue is a side channel for messages that cannot be processed no matter how often you try — a corrupt payload, or an event referencing a customer that no longer exists. Left alone, such a "poison message" is retried indefinitely, and if it carries an ordering key it also holds up every later message for that key. Configure a DLQ and the broker gives up after N attempts, moves the message aside, and lets the rest flow — while keeping the failure somewhere a human can go and read it.

```bash
# Create the DLQ topic and subscription
gcloud pubsub topics create order-events-dlq
gcloud pubsub subscriptions create order-events-dlq-sub --topic=order-events-dlq

# Important: Grant the Pub/Sub service agent permission to forward messages
PROJECT_NUMBER=$(gcloud projects describe your-project-id --format="value(projectNumber)")
PUBSUB_SA="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"

gcloud pubsub topics add-iam-policy-binding order-events-dlq \
  --member="serviceAccount:${PUBSUB_SA}" --role="roles/pubsub.publisher"
gcloud pubsub subscriptions add-iam-policy-binding order-events-sub \
  --member="serviceAccount:${PUBSUB_SA}" --role="roles/pubsub.subscriber"

# Set the maximum delivery attempts
gcloud pubsub subscriptions update order-events-sub \
  --dead-letter-topic=order-events-dlq --max-delivery-attempts=5
```

Those two IAM bindings are easy to omit, so it is worth understanding who they are for. Forwarding a failed message to the DLQ is not something *your* application does — Pub/Sub does it, on your behalf, which means Pub/Sub needs permission to read from the source subscription and publish to the DLQ topic. It uses a Google-managed identity for this, the **service agent**, which exists automatically in every project under the `service-<PROJECT_NUMBER>@gcp-sa-pubsub.iam.gserviceaccount.com` address. Granting the roles to your own service account instead looks entirely plausible and achieves nothing.

Get it wrong and there is no error to find: messages simply keep being redelivered, the DLQ stays empty, and the only symptom is an oldest-unacked-message age that keeps climbing.

Two companion settings matter here. The first is the retry policy: a subscription defaults to *retry immediately*, so on a pull subscription a poison message burns through all five attempts as fast as your handler can nack them. Pacing them is a separate call:

```bash
gcloud pubsub subscriptions update order-events-sub \
  --min-retry-delay=10s --max-retry-delay=600s
```

The second is that a DLQ changes the advice from Part 3. Without one, an unparseable payload has to be acked, because a nack means redelivery until retention expires. With one, nack is the better answer: Pub/Sub counts the attempts and moves the message aside for you, so the failure ends up somewhere inspectable instead of only in a log line.

### Message Filtering

If a subscription only cares about some of a topic's messages, you can let Pub/Sub do the filtering rather than receiving everything and discarding most of it in code. The filter is evaluated on the broker: non-matching messages are acknowledged automatically and never travel to your service at all, so they cost you no bandwidth and no handler time. The expression reads message *attributes*, which is exactly what our transport sets `eventType` for:

```bash
gcloud pubsub subscriptions create order-completed-sub \
  --topic=order-events \
  --message-filter='attributes.eventType = "OrderCompletedV1"'
```

Be deliberate about that expression, because filters are immutable: changing one means deleting and recreating the subscription, which throws away every message still waiting in it. In practice you don't edit a filter in production — you create a second subscription with the new filter, move consumers across, then delete the old one.

### Exactly-Once Delivery

**What is Exactly-Once Delivery?** It is a broker guarantee that an acknowledged message will not be redelivered. While "at-least-once" guarantees a message is delivered but might arrive multiple times, "exactly-once" attempts to ensure it arrives one time only.

Pub/Sub offers an "exactly-once delivery" setting on pull subscriptions. This sounds like a silver bullet, but it comes with trade-offs:

```bash
gcloud pubsub subscriptions update order-events-sub --enable-exactly-once-delivery
```

1. **Acknowledgment becomes a distributed, fallible operation.** You must check the `CompletableFuture` returned by `ack()` to ensure it actually succeeded:
   ```java
   message.ack().join(); // ignoring this result defeats the point of exactly-once
   ```
2. **The documented cost is latency, not throughput.** Exactly-once subscriptions have significantly higher publish-to-subscribe latency than regular ones. High throughput is still reachable, but it requires a StreamingPull subscriber — and combining exactly-once with ordering limits a single client to an order of thousands of messages per second, which is worth knowing here because we order on `customerId`.
3. **It does not replace idempotent consumers.** The guarantee covers the broker's own redelivery and nothing else, so every duplicate created *outside* Pub/Sub still arrives: an outbox resubmit after a failed publish, a `seek` that replays a window, a retry in the publisher. The setting narrows the problem; it does not remove it.

One scope limit is easy to miss: the guarantee holds only while a subscriber connects to Pub/Sub in the same region. That is a different constraint from the publisher-side regional endpoint that ordering needs — that one keeps a key in a single lane, this one decides whether the guarantee applies at all.

### Replaying Messages with Seek

Suppose you ship a bug on Tuesday and discover on Thursday that two days of orders were processed wrongly. `seek` moves a subscription's cursor: rewind it to Tuesday morning and Pub/Sub redelivers every message published since that moment, this time to your fixed code. The messages themselves were never modified — only your subscription's idea of how far it had got.

The client below is a `SubscriptionAdminClient`, an administrative API rather than anything your request path touches:

```java
SUBSCRIPTION_ADMIN.seek(SeekRequest.newBuilder()
        .setSubscription(subscriptionPath(SUBSCRIPTION))
        .setTime(Timestamp.newBuilder().setSeconds(beforePublish.getEpochSecond()).build())
        .build());
```

There is one prerequisite, and it has to be decided long before the incident: seeking *backwards* only replays messages that still exist, so the subscription must have been created with `retainAckedMessages`. Without it, an acked message is discarded immediately and no amount of seeking brings it back. (Seeking *forward* always works, and is the quick way to abandon a backlog you have decided not to process.)

How far back you can rewind is bounded by retention, and there are two knobs, confusingly both called `message_retention_duration` — one on the subscription, one on the topic. The subscription setting keeps *unacknowledged* messages for seven days by default, configurable from ten minutes up to 31 days. Topic-level retention, capped at 31 days too, does something the subscription setting cannot: it lets a subscription seek back past its own creation time, replaying messages published before it existed. Either way the ceiling is 31 days — `seek` is an incident-response tool, not an archive.

---

## Part 5: Operations & Testing

Our architecture is built and hardened. Now, how do we operate and test it reliably?

### Provisioning

There are three idempotent routes to create the Pub/Sub topology for this repository. For complete instructions and details on what gets created (including the Terraform variables and IAM bindings), check the dedicated [infra/README.md](infra/README.md) file.

| Route | Use when |
|---|---|
| `infra/terraform` | Real GCP, reviewable infrastructure as code |
| `scripts/setup-pubsub.sh` | Real GCP, when you prefer `gcloud` commands |
| `scripts/setup-emulator.sh` | Local emulator testing |

To use Terraform:
```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars # edit your project ID
terraform init
terraform apply
```

### Managing the Outbox

Two settings in `application.yaml` govern how the outbox behaves in production — one makes failed events retry on startup, the other decides what happens to the rows once they succeed:

```yaml
spring:
  modulith:
    events:
      republish-outstanding-events-on-restart: true
      completion-mode: UPDATE
```

`completion-mode` has three settings, and `UPDATE` — the one configured above — is already the default. We set it explicitly because the behaviour it implies is load-bearing, not because we are overriding anything:

- `UPDATE` stamps the row as completed and leaves it in place, turning `event_publication` into an audit trail of everything you have ever published. That is precisely what you want during an incident, when the question is whether an event was actually sent or merely believed to be.
- `DELETE` removes the row the instant the broker accepts the message, so the table only ever holds events still in flight.
- `ARCHIVE` moves completed rows to a separate archive table, keeping the hot table small without discarding the history.

The price of the default is that nothing prunes the table, so it grows forever. That makes two jobs yours: delete old completed rows on a schedule, and publish the current backlog as a metric so you can see trouble coming.

```java
@Component
class EventPublicationMaintenance {

    EventPublicationMaintenance(
            CompletedEventPublications completed, EventPublicationRegistry registry, MeterRegistry meters) {
        this.completed = completed;
        Gauge.builder("modulith.events.incomplete", registry, r -> r.findIncompletePublications().size())
                .description("Externalized event publications not yet acknowledged by the broker")
                .register(meters);
    }

    @Scheduled(cron = "@daily")
    void purgeCompletedPublications() {
        completed.deletePublicationsOlderThan(RETENTION);
    }
}
```

**Important:** Spring Cloud GCP auto-configures a `TaskScheduler`, which can conflict with Spring's default `@Scheduled` execution. Be sure to define your own explicitly named `TaskScheduler` bean to prevent your outbox cleanup from running on a Pub/Sub I/O thread:

```java
@Bean
ThreadPoolTaskScheduler taskScheduler() {
    var scheduler = new ThreadPoolTaskScheduler();
    scheduler.setPoolSize(2);
    scheduler.setThreadNamePrefix("modulith-sched-");
    return scheduler;
}
```

### Throughput Settings

When operating at scale, you need to tune publisher batching, retry behaviour, and subscriber flow control. One setting here deserves a warning label: **publisher retry settings must be specified as a complete group.**

`Publisher.Builder` asserts that values like `totalTimeout` and `initialRpcTimeout` are positive, so if you set three of the retry properties the remaining ones stay at zero and *every* publish throws `IllegalArgumentException`. What makes this nastier than it sounds is where it surfaces: externalization runs on a background thread, so the app starts perfectly and every HTTP request still returns `200`. All you get is a stack trace buried in the logs and a `modulith.events.incomplete` gauge that climbs and never comes down.

```yaml
spring:
  cloud:
    gcp:
      pubsub:
        publisher:
          enable-message-ordering: true   # required: the transport sets an ordering key
          batching:            # fewer, larger requests: latency and cost for throughput
            enabled: true
            element-count-threshold: 100
            request-byte-threshold: 1048576
            delay-threshold-seconds: 1
          retry:               # must be a COMPLETE set
            total-timeout-seconds: 60
            max-attempts: 5
            initial-retry-delay-seconds: 1
            retry-delay-multiplier: 2.0
            max-retry-delay-seconds: 32
            initial-rpc-timeout-seconds: 15
            rpc-timeout-multiplier: 2.0
            max-rpc-timeout-seconds: 30
            jittered: true
        subscriber:
          parallel-pull-count: 2
          max-ack-extension-period: 10 # MINUTES, not seconds — the default is 60
          flow-control:        # cap unacked work held in memory
            max-outstanding-element-count: 1000
            max-outstanding-request-bytes: 104857600
```

Two of those subscriber keys govern time and memory rather than speed. Pub/Sub gives a consumer a limited window — the **ack deadline** — to answer before it assumes the consumer has died and redelivers the message. The Spring client automatically keeps extending that deadline while your handler is still running, and `max-ack-extension-period` caps how long it will go on doing so. `flow-control` then bounds how much unacknowledged work the client holds in memory at once, which is what stops a sudden backlog from turning into an `OutOfMemoryError`.

### Monitoring and Security

The most important metric to monitor on the application side is `modulith.events.incomplete`. This represents the outbox backlog. If this number climbs steadily, it means your app is failing to publish messages to the broker.

On the GCP side, alert on the *age* of the oldest unacknowledged message rather than on how many messages are waiting. The count is the more obvious metric and the more misleading one: a subscription chewing happily through thousands of messages per second looks identical to a healthy one, even while a single unprocessable message sits stuck at the head of one key. Age catches that; a count never will. The metric is `subscription/oldest_unacked_message_age`.

For security, grant the application's service account narrow roles on the individual topics and subscriptions rather than at the project level — a `roles/pubsub.editor` binding on the whole project is how one compromised service ends up able to delete another team's subscriptions.

Push endpoints need one extra step, and it is not optional. A push subscription is just an HTTP POST to a URL, so without verification your endpoint will happily accept an "order" from anyone on the internet who guesses the path. Configure the subscription to attach an OIDC token — a short-lived JWT that Google signs on behalf of a service account you nominate — and have Spring Security verify it on the way in:

```yaml
spring.security.oauth2.resourceserver.jwt.issuer-uri: https://accounts.google.com
```

That property is necessary but nowhere near sufficient. It does nothing at all unless `spring-boot-starter-oauth2-resource-server` is on the classpath, and even then it only proves Google signed the token — not that *your* subscription sent it. A `SecurityFilterChain` still has to require authentication on the push path and check the token's audience and service-account email against the ones you configured. This repository deliberately ships without any of it (`PubSubPushController` carries a `TODO`), which is why it appears again under "What this leaves out".

### Testing with the Emulator

Google ships a Pub/Sub emulator that removes most of the difficulty of testing an event-driven system. Our suite runs it in Docker via Testcontainers, so the tests need no GCP project, no credentials and no network — just a Docker daemon.

```bash
./gradlew test            # ~20 tests; the E2E ones use the emulator, no GCP project needed
./gradlew probeEmulator   # validates what the emulator actually enforces
./gradlew liveGcpTest     # needs PUBSUB_LIVE_TEST_PROJECT; creates BILLABLE resources
```

It's worth knowing what the emulator will and won't do. It genuinely enforces **message ordering**, **message filtering** and **dead-letter queues** — each verified by `./gradlew probeEmulator`, which checks that the behaviour happens rather than that the configuration was merely accepted. It also validates payloads against a **topic schema**, though the probe only exercises that with JSON encoding, so treat BINARY Avro enforcement as unverified locally. It does *not* enforce exactly-once delivery or retry-policy timings.

Asserting on an asynchronous pipeline needs a little care: the moment `completeOrder` returns, the message almost certainly hasn't been published yet, so a straight assertion would fail roughly every time. [Awaitility](https://github.com/awaitility/awaitility) solves this by retrying the assertion block until it passes or a timeout expires, which is far more reliable than sprinkling `Thread.sleep` around:

```java
@Test
void orderCompletedEventReachesPubSub() {
    var orderId = orderService.completeOrder("customer-123");

    // externalization runs after commit, asynchronously — poll until it shows up
    await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> {
        var messages = pubSubTemplate.pullAndAck(SUBSCRIPTION, 10, true);
        assertThat(messages).isNotEmpty();

        var message = messages.getFirst();
        assertThat(message.getData().toStringUtf8())
                .contains(orderId.toString())
                .contains("\"schemaVersion\":\"1\"");
        assertThat(message.getAttributesMap()).containsEntry("eventType", "OrderCompletedV1");
        assertThat(message.getOrderingKey()).isEqualTo("customer-123");
    });
}
```

To test outbox recovery, we can artificially simulate broker outages at the transport level:

```java
@Bean
static BeanPostProcessor failFirstTransport() {
    return new BeanPostProcessor() {
        @Override
        public Object postProcessAfterInitialization(Object bean, String beanName) {
            if (bean instanceof EventExternalizationTransport real) {
                // Fail the first attempt, succeed on the rest
                return (EventExternalizationTransport) (payload, target) -> attempts.getAndIncrement() == 0
                        ? CompletableFuture.failedFuture(new IllegalStateException("broker unavailable"))
                        : real.externalize(payload, target);
            }
            return bean;
        }
    };
}
```

This allows us to test that if the broker is down, the outbox retains the event, and upon a resubmit request, it successfully clears the backlog:

```java
var orderId = orderService.completeOrder("customer-123");

// first attempt failed → the event must survive as an incomplete publication
await().untilAsserted(() -> assertThat(registry.findIncompletePublications()).isNotEmpty());

// broker recovers: resubmit, as republish-outstanding-events-on-restart does at startup
incompletePublications.resubmitIncompletePublications(publication -> true);

await().untilAsserted(() -> assertThat(registry.findIncompletePublications()).isEmpty());
```

---

## Reference & Summary

### What this leaves out

Deliberate gaps, so you know where the guide stops:
- **Persisted idempotency.** `ProcessedKeys` is in memory, so dedupe resets on restart. A real consumer needs a unique index or an upsert.
- **OIDC verification on the push endpoint.** Covered under Monitoring and Security, but still a `TODO` in the codebase, so as written the endpoint would accept an order event from anyone who found the URL.
- **Export subscriptions.** Pub/Sub can write straight to BigQuery or Cloud Storage with no subscriber at all.
- **Schema revisions.** The guide versions contracts by convention. Pub/Sub can also manage schema revisions.
- **Tracing.** Propagating trace context through message attributes.
- **Multi-region topologies.**

### Summary

- The `EventExternalizationTransport` SPI adds GCP Pub/Sub to Spring Modulith in one small class plus two bean definitions — the second, `EventExternalizerModuleListener`, is the one nothing auto-registers for you. The registry handles persistence, retry-on-restart, and completion tracking.
- The transport maps the event's routing key onto an ordering key, ensuring per-customer message ordering.
- Externalizing a versioned contract, rather than internal domain events, decouples refactoring from consumers.
- Consumer correctness is mostly about separating permanent from transient failures and giving each consumer its own bounded deduplication store to enforce idempotency.
- Most advanced features (ordering, filtering, dead-lettering, schemas) are testable locally using the Pub/Sub emulator.

Repository with full code is here: https://github.com/GaetanoPiazzolla/modulith-gcp-pubsub
