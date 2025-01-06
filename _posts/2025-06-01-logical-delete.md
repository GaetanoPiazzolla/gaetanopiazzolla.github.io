---
title: Mastering Logical Deletion in Spring Boot with JPA - Enhancing @SQLDelete with Custom Parameters
layout: post
date: 2025-01-06 18:00:00 +0100
categories:
  - Java
  - JPA
  - SpringBoot
---

A practical guide to implementing logical delete with Spring Data JPA, designed for clarity and real-world use.

**The Full code is available on [GitHub](https://github.com/GaetanoPiazzolla/logical-delete).**

---

<div align="center">
    <img src="https://cdn-images-1.medium.com/v2/resize:fit:1600/0*VJbObkWNfbwyYDRq" style="content-visibility:auto" alt="Fire" loading="lazy" decoding="async">
</div>
<p style="text-align:center; font-style: italic;">Photo by <a href="https://unsplash.com/@varmamanyu?utm_source=medium&utm_medium=referral">Manyu Varma</a> on Unspash</p>

---

## Introduction

Data deletion can be permanent or logical. Logical deletion marks data as deleted without physically removing it from the database, 
making it useful for auditing and historical data retention. Hibernate Envers supports deletion auditing but can introduce complexity and performance overhead.
(See this and some other use cases of [Hibernate Envers Here](https://github.com/GaetanoPiazzolla/hibernate-envers-tutorial/tree/master)).

In practice, Logical deletion involves adding columns to mark an entity as deleted. 
We'll use _deleted_at_, _deleted_by_, and _deleted_reason_ columns to store when an entity was deleted, 
who deleted it, and the reason for deletion.

Since most entities might require this information along with versioning and identification, 
we'll create a base entity class that all entities can extend:

```java
@Getter
@Setter
@MappedSuperclass
public abstract class AbstractEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Version
    @Column(nullable = false, columnDefinition = "integer DEFAULT 0")
    private Integer databaseVersion;

    @Column
    private LocalDateTime deletedAt;

    @Column
    private String deletedBy;

    @Column
    private String deletedReason;
}
```

---

## Basic Implementation

The standard basic implementation is to use an update query to set the deleted columns:

```java
public void deleteAuthorBasic(Integer id, String reason) {
    authorRepository.findById(id).ifPresent(author -> {
        author.setDeletedReason(reason);
        author.setDeletedAt(LocalDateTime.now());
        author.setDeletedBy("get current user from Security Context");
        authorRepository.save(author);
    });
}
```

This implementation is not ideal because:

**1) Extra Database Call**: Fetches the entity before updating, causing two round-trips to the database.

**2) Bypassing JPA Lifecycle:** The standard JPA delete method isn't used, which can lead to issues with cascading and Standard JPA lifecycle events.
   (_@PreRemove_, _@PostRemove_ will not be triggered)

**3) Concurrency Issues**: No version control on deletion, which could lead to race conditions.

**4) Security Concerns**: _DeletedBy_ is set manually, which could be error-prone and insecure.

Let's see how we can improve this implementation in the next section.

---

## Effective Implementation with @SQLDelete and @SQLRestriction

A more efficient approach uses Hibernate's [@SQLDelete](https://docs.jboss.org/hibernate/orm/current/javadocs/org/hibernate/annotations/SQLDelete.html) 
and [@SQLRestriction](https://docs.jboss.org/hibernate/orm/current/javadocs/org/hibernate/annotations/SQLRestriction.html) annotations. 
Those annotations are used to override the default delete behavior and to exclude logically deleted entities from queries:

```java
@Entity
@Table(name = "authors")
@SQLDelete(
    sql = "UPDATE authors SET deleted_at = CURRENT_TIMESTAMP, deleted_by = :current_user, " +
          "deleted_reason = :deleted_reason WHERE id = ? AND database_version = ?")
@SQLRestriction("deleted_at IS NULL")
public class Author extends AbstractEntity {
    // fields
}
```

As you can see, the delete query is an update with two parameters, the current user and the reason for deletion.
The _id_ and the _database_version_ are used in the where clause and Hibernate will automatically set the values.

**We can use a custom Hibernate [Statement Inspector](https://docs.jboss.org/hibernate/orm/current/javadocs/org/hibernate/resource/jdbc/spi/StatementInspector.html) to replace the placeholder vars
(_current_user_ and _deleted_reason_) dynamically.**

First of all, we need to register it in the _application.yaml_ file:

```yaml
spring:
  jpa:
    properties:
      hibernate:
        session_factory:
          statement_inspector: gae.piaz.logical.delete.config.CustomStatementInspector
```

The _CustomStatementInspector_ is nothing else than a Spring _Component_ that implements the provided interface:

```java
@Component
public class CustomStatementInspector implements StatementInspector {

    private static final ThreadLocal<String> deleteReason = ThreadLocal.withInitial(() -> "none");

    @Override
    public String inspect(String sql) {
        if (sql.contains(":current_user")) {
            sql = sql.replace(":current_user", "'" + getCurrentUserId() + "'");
        }
        if (sql.contains(":deleted_reason")) {
            sql = sql.replace(":deleted_reason", "'" + deleteReason.get() + "'");
        }
        return sql;
    }

    private String getCurrentUserId() {
        return UUID.randomUUID().toString();  // Replace with Spring Security context if applicable
    }

    public void setDeleteReason(String reason) {
        deleteReason.set(reason);
    }

    public void clear() {
        deleteReason.remove();
    }
}
```

This component has a _ThreadLocal_ variable to store the reason for deletion and a method to set it.

Hibernate calls the inspect method before executing any query,
so we can replace the placeholders of the @SQLDelete with the actual values.

**Implementing the logical _delete_ in the service layer is now straightforward:**

```java
public void deleteAuthorEffective(Integer id, String reason) {
    customStatementInspector.setDeleteReason(reason);
    authorRepository.deleteById(id);
    // customStatementInspector.clear();
}
```

With Virtual Threads, there should be no need to manually clean up the ThreadLocal variable, but it's always a good practice to do so.
Check the previous article to set up a custom Spring interceptor to clean up the _ThreadLocal_ variable: 
[Event Notification Pattern](https://gaetanopiazzolla.github.io/spring/design-patterns/2024/12/15/event-spring.html).

---

## Conclusion

Implementing logical delete with JPA in Spring Boot can be straightforward and efficient with the right approach.
By using Hibernate's _@SQLDelete_ and _@SQLRestriction_ annotations, we can achieve logical deletion without the drawbacks of traditional methods.

The Hibernate _StatementInspector_ ensures dynamic parameter replacement, making the process seamless and secure.

The full code is available on [GitHub](https://github.com/GaetanoPiazzolla/logical-delete).

Feel free to [contact me](mailto:gae.piaz@gmail.com) for any questions or critiques. 