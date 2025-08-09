---
title: Fetching Logical Deleted Entities with JPA Like a PRO - Advanced Techniques for Accessing Archived Data
image: /assets/trani-inverno-2024.jpg
layout: post
date: 2025-08-09 14:00:00 +0100
categories:
  - Java
  - JPA
  - SpringBoot
---

The best way of accessing logical deleted entities without writing weird queries or duplicating repository methods.

**The Full code is available on [GitHub](https://github.com/GaetanoPiazzolla/logical-delete).**

---

<div align="center">
    <img src="/assets/trani-inverno-2024.jpg" style="content-visibility:auto" alt="Trani" loading="lazy" decoding="async">
</div>
<p style="text-align:center; font-style: italic;">Trani, Cold winter Evening - 2024 </p>

---

## Introduction

In the [previous article](https://gaetanopiazzolla.github.io/java/jpa/springboot/2025/01/06/logical-delete.html), 
we explored how to implement logical deletion efficiently using `@SQLDelete` and `@SQLRestriction` annotations. 
However, logical deletion creates a new challenge: **how do we access deleted entities when we need them for auditing, 
restoration, or reporting purposes?**

While `@SQLRestriction` effectively hides deleted entities from normal queries, 
there are legitimate scenarios where we need to retrieve them:

- **Audit trails**: Viewing historical data for compliance
- **Data restoration**: Recovering accidentally deleted records
- **Reporting**: Including deleted entities in specific reports
- **Admin operations**: Managing archived data

This article demonstrates how to elegantly solve this problem using advanced JPA techniques and AspectJ, avoiding the pitfalls of naive implementations.

---

## The Naive Approach: Custom Named Queries

The most straightforward approach is to create custom repository methods with native queries that explicitly query deleted entities:

```java
@Repository
public interface AuthorRepository extends JpaRepository<Author, Integer> {

    @Query(value = "SELECT * FROM authors WHERE id = ? and deleted_at is not null", nativeQuery = true)
    Optional<Author> findByIdDeleted(Integer id);
    
    @Query(value = "SELECT * FROM authors WHERE deleted_at is not null", nativeQuery = true)
    List<Author> findAllDeleted();
}
```

Then in the service layer:

```java
@Service
public class AuthorService {
    
    public Author fetchDeletedAuthorBasic(Integer id) {
        Optional<Author> deletedAuthOpt = authorRepository.findByIdDeleted(id);
        return deletedAuthOpt.orElseThrow();
    }
}
```

### Problems with the Naive Approach

This implementation has several significant drawbacks:

**1) Query Duplication**: Every repository method needs a "deleted" variant, doubling the codebase size.

**2) Complex Joins**: When entities have relationships, you must manually add deleted conditions to all joins:

```java
@Query(value = """
    SELECT a.* FROM authors a 
    JOIN books b ON a.id = b.author_id 
    WHERE a.deleted_at is not null 
    AND b.deleted_at is not null 
    AND a.id = ?
    """, nativeQuery = true)
Optional<Author> findDeletedAuthorWithBooks(Integer id);
```

**3) Maintenance Nightmare**: Schema changes require updating multiple query variants.

**4) No Reusability**: Existing repository methods cannot be reused for deleted entities.

**5) Error-Prone**: Easy to forget adding deleted conditions in complex queries.

---

## The Professional Approach: @TransactionalDeleted Annotation

A much more elegant solution leverages the existing infrastructure we built for logical deletion. 
Instead of duplicating queries, we can **temporarily modify the SQL restriction behavior** 
to access deleted entities using the same repository methods.

### Basic Usage

With the `@TransactionalDeleted` annotation, accessing deleted entities becomes trivial:

```java
@Service
public class AuthorService {
    
    @TransactionalDeleted
    public Author fetchDeletedAuthorEffective(Integer id) {
        return authorRepository.findById(id)  // Same method, different context!
            .orElseThrow();
    }
}
```

**No custom queries, no code duplication, no maintenance overhead.**

---

## Implementation Steps

Let's build this system step by step, understanding each component:

### Step 1: Enhanced SQL Restriction Inspector

First, we need to create a `SQLRestrictionStatementInspector` to support different modes:

```java
@Slf4j
public class SQLRestrictionStatementInspector implements StatementInspector {

    private static final Pattern archivedPattern = Pattern.compile(
        "(\\b\\w+\\.)?deleted_at\\s+is\\s+null", Pattern.CASE_INSENSITIVE);

    public enum DeletedMode {
        NORMAL,  // Keep default behavior - deleted_at is null
        DELETED, // Show only logically deleted - deleted_at is not null  
        ALL      // Query both deleted and not deleted
    }

    private static final ThreadLocal<DeletedMode> currentDeletedMode = 
        ThreadLocal.withInitial(() -> DeletedMode.NORMAL);

    public static void setDeletedMode(DeletedMode mode) {
        log.trace("Switching DeleteMode to {}", mode);
        currentDeletedMode.set(mode);
    }

    @Override
    public String inspect(String sql) {
        if (currentDeletedMode.get() == DeletedMode.DELETED) {
            sql = sql.replaceAll("(?i)deleted_at\\s+is\\s+null", "deleted_at is not null");
        } else if (currentDeletedMode.get() == DeletedMode.ALL) {
            Matcher archivedMatcher = archivedPattern.matcher(sql);
            sql = archivedMatcher.replaceAll("1=1");
        }
        return sql;
    }
}
```

This statement inspector is automatically inspecting every query we execute. 
It's enough to link it in the `application.yaml` under `spring.jpa.properties.hibernate.session_factory.statement_inspector`.

### Step 2: Deleted Transaction Template

Create a specialized transaction template that automatically manages the deleted mode:

```java
public class DeletedTransactionTemplate extends TransactionTemplate {

    public DeletedTransactionTemplate(PlatformTransactionManager transactionManager) {
        super(transactionManager);
    }

    @Override
    public <T> T execute(@NonNull TransactionCallback<T> action) {
        return executeWithDeletedMode(() -> super.execute(action));
    }

    public <T> Optional<T> executeOptional(@NonNull TransactionCallback<T> action) {
        return Optional.ofNullable(executeWithDeletedMode(() -> super.execute(action)));
    }

    private <T> T executeWithDeletedMode(Supplier<T> supplier) {
        SQLRestrictionStatementInspector.setDeletedMode(
            SQLRestrictionStatementInspector.DeletedMode.DELETED);
        try {
            return supplier.get();
        } finally {
            SQLRestrictionStatementInspector.setDeletedMode(
                SQLRestrictionStatementInspector.DeletedMode.NORMAL);
        }
    }
}
```

### Step 3: The @TransactionalDeleted Annotation

Create a simple marker annotation:

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface TransactionalDeleted {
}
```

### Step 4: AspectJ Interceptor

Implement the aspect that intercepts annotated methods:

```java
@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class TransactionalDeletedAspect {

    private final DeletedTransactionTemplate deletedTransactionTemplate;

    @Around("@annotation(annotation)")
    public Object executeInDeletedTransaction(
            ProceedingJoinPoint joinPoint, 
            TransactionalDeleted annotation) {

        log.trace("Executing method {} in deleted transaction context", 
            joinPoint.getSignature().toShortString());

        return deletedTransactionTemplate.execute(_ -> {
            try {
                return joinPoint.proceed();
            } catch (RuntimeException e) {
                throw e;
            } catch (Throwable e) {
                throw new RuntimeException(
                    "Error executing method in deleted transaction", e);
            }
        });
    }
}
```

### Step 5: Configuration

Enable aspects and add the `DeletedTransactionTemplate` in Spring context:

```java
@Configuration
@EnableAspectJAutoProxy
public class TransactionsConfig {

    @Bean
    public DeletedTransactionTemplate deletedTransactionTemplate(
            PlatformTransactionManager transactionManager) {
        return new DeletedTransactionTemplate(transactionManager);
    }
}
```

---

## Benefits of the Professional Approach

**✅ Code Reusability**: Use existing repository methods without duplication

**✅ Automatic Join Handling**: Complex queries with joins work automatically

**✅ Maintainability**: Single source of truth for business logic

**✅ Type Safety**: No native SQL strings to maintain

**✅ Consistent Behavior**: Same method signatures for deleted and active entities

**✅ Transparent Usage**: Clean, annotation-driven API

---

## Testing the Implementation

Here's how you can test both approaches:

```java
@SpringBootTest
class FetchingDeletedTest {

    @ParameterizedTest
    @ValueSource(strings = { "/basic", "/effective" })
    void testFetchDeletedAuthor(String endpoint) throws Exception {
        
        Author author = createAndSaveAuthor();
        authorRepository.delete(author); // Logical deletion

        String response = mockMvc.perform(
            get("/api/authors" + endpoint + "/deleted/" + author.getId()))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

        AuthorDTO dto = objectMapper.readValue(response, AuthorDTO.class);
        assertNotNull(dto.firstName());
        assertNotNull(dto.lastName());
    }
}
```

---

## Conclusion

The `@TransactionalDeleted` annotation approach provides a clean, maintainable solution for accessing logical deleted entities. By leveraging AspectJ and Hibernate's statement inspection capabilities, we achieve:

- **Zero code duplication** between active and deleted entity access
- **Automatic handling** of complex queries and joins
- **Seamless integration** with existing repository methods
- **Thread-safe operation** using ThreadLocal state management

This pattern demonstrates how combining Spring's AOP capabilities with Hibernate's extensibility can create powerful, reusable solutions that keep code clean and maintainable.

**Next Steps**: Consider extending this pattern to support mixed queries (both active and deleted entities) 
or implementing audit logging for deleted entity access.

---

*Feel free to [contact me](mailto:gae.piaz@gmail.com) for any questions or suggestions about this implementation.*
