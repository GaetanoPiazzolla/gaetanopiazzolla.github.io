---
title: Understanding Spring's Proxy Pattern - How @Transactional, @Cacheable, and @Secured Actually Work
layout: post
date: 2025-06-23 18:00:00 +0100
categories:
  - Java
---

_Disclaimer: This article was written with a small aid of LLMs (Claude and ChatGPT)_

---

Last week, I was debugging a production issue that had me stumped for hours. 
A critical transaction wasn't rolling back when it should have, 
even though the method was clearly annotated with `@Transactional`. 
The database was corrupted, and me as well: I was questioning everything I thought I knew about Spring.

Then it hit me. The problem wasn't with Spring's transaction management — it was with my fundamental misunderstanding of how Spring actually works 
under the hood. That revelation led me down a rabbit hole that completely changed how I think about the framework we all use every day.

The culprit behind both the magic and the mystery was the Proxy Pattern—a design pattern where one object acts as a placeholder 
or surrogate for another object to control access to it. 
In [Spring's case](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html), when you annotate a method with `@Transactional` or `@Cacheable`, 
Spring doesn't modify your original class. 

Instead, it creates a proxy object that wraps your original object, 
intercepting method calls to add functionality like transaction management or caching before 
delegating to your actual business logic. 
This proxy appears identical to your original object from the outside, 
but internally it's a sophisticated interceptor that enables Spring's declarative programming model.

<div align="center">
<img src="/assets/proxy-pattern.png" style="content-visibility:auto"
alt="Proxy Pattern glass door"
loading="lazy"
decoding="async">
</div>

## The Discovery That Changes Everything

Here's what I discovered: Every time you use annotations like `@Transactional`, `@Cacheable`, or `@Secured`, you're not just adding metadata to your classes. You're triggering Spring to perform what I now call "The Great Substitution"—a sleight of hand so seamless that most developers never realize it's happening.

Let me show you exactly what I mean. When you write this seemingly innocent code:

```java
@Service
@Transactional
public class UserService {
    public void createUser(User user) {
        userRepository.save(user);
    }
}
```

You think Spring is just managing transactions for your `UserService` class. But here's the shocking truth: the object that Spring injects into your controllers isn't your `UserService` at all. It's something else entirely—a proxy object that wraps your original service and intercepts every method call.

This discovery explained everything about my production bug. But more importantly, it revealed the elegant design pattern that powers Spring's most beloved features: the Proxy Pattern.

## How I Uncovered Spring's Best-Kept Secret

To understand what was really happening, I had to dig into Spring's source code. What I found was fascinating. When Spring encounters annotations like `@Transactional`, it doesn't just make a note to "do transaction stuff later." Instead, it immediately begins constructing a completely different object—one that looks identical to your original service but possesses capabilities your original class never had.

This process happens in several stages, and understanding each stage was crucial to solving my production issue:

First, Spring creates your original `UserService` instance exactly as you wrote it. This object has no special powers—it's just a regular Java object with your business logic.

Then comes the magic. Spring wraps this original object inside a proxy. This proxy implements the same interface (or extends the same class) as your original service, so from the outside, it looks identical. But internally, it's a sophisticated interceptor that can execute code before and after every method call.

Finally, Spring performs the substitution. Wherever you expect to receive your original `UserService`, Spring gives you the proxy instead. Your application code never knows the difference—until something goes wrong.

## The Two Faces of Spring's Proxy System

As I dug deeper into my investigation, I discovered that Spring actually might use two different proxy technologies.

The first type is [JDK Dynamic Proxies](https://docs.oracle.com/javase/8/docs/technotes/guides/reflection/proxy.html). 
The second type is [CGLIB](https://github.com/cglib/cglib) proxies 
(there is no direct dependency with CGLIB tho, it has been repackaged directly into spring-core).

In this TEST: [https://github.com/GaetanoPiazzolla/spring-proxies-test](https://github.com/GaetanoPiazzolla/spring-proxies-test) - I then discovered that:

- JDK Dynamic Proxies are used by default only in specific cases with Spring Boot 3.x
- CGLIB Proxies is the Default proxy mechanism for both interface and non-interface Spring-Beans when using @EnableCaching or @EnableTransactionManagement.

## The Moment Everything Clicked: Three Proxy Powers in Action

Armed with this knowledge about proxy types, I began to understand how Spring implements its most powerful features. 
Each annotation triggers a different type of proxy behavior, but they all follow the same fundamental pattern: intercept, enhance, proceed.

### Transaction Management: The Database Safety Net

When I added `@Transactional` to my service method, Spring's proxy was silently wrapping my business logic with transaction management code:

```java
@Service
public class BankService {
    
    @Transactional
    public void transferMoney(Account from, Account to, BigDecimal amount) {
        from.withdraw(amount);
        to.deposit(amount);
    }
}
```

What I thought was happening was simple method execution. What was actually happening looked more like this inside the proxy:

```java
public Object intercept(Object obj, Method method, Object[] args, MethodProxy proxy) {
    // Proxy starts a database transaction
    TransactionStatus tx = transactionManager.getTransaction(txDefinition);
    try {
        // Execute my actual business logic
        Object result = method.invoke(target, args);
        // Commit if successful
        transactionManager.commit(tx);
        return result;
    } catch (Exception e) {
        // Rollback on any exception
        transactionManager.rollback(tx);
        throw e;
    }
}
```

This revelation was the first piece of solving my production puzzle.

### Caching: The Performance Multiplier

The same pattern applied to caching, which I had implemented in another service:

```java
@Service
public class ProductService {
    
    @Cacheable("products")
    public Product getExpensiveProduct(Long id) {
        return calculateComplexProduct(id);
    }
    
    @CacheEvict("products")
    public void updateProduct(Product product) {
        productRepository.save(product);
    }
}
```

The proxy was intercepting these method calls and adding caching logic:

```java
// Before executing my method
String cacheKey = generateKey(method, args);
Object cached = cacheManager.get(cacheKey);
if (cached != null) {
    return cached;  // Skip expensive computation
}

// Execute my method and cache the result
Object result = method.invoke(target, args);
cacheManager.put(cacheKey, result);
return result;
```

### Security: The Silent Guardian

The security annotations followed the same interception pattern:

```java
@RestController
public class AdminController {
    
    @Secured("ROLE_ADMIN")
    @GetMapping("/admin/users")
    public List<User> getAllUsers() {
        return userService.findAll();
    }
}
```

The proxy was checking authorization before allowing method execution:

```java
// Verify permissions before proceeding
Authentication auth = SecurityContextHolder.getContext().getAuthentication();
if (!hasRequiredRole(auth, "ROLE_ADMIN")) {
    throw new AccessDeniedException("Access denied");
}
// Only execute method if authorized
return method.invoke(target, args);
```

Each of these features worked through the same proxy mechanism, just with different interception logic.

## The Breakthrough: Why My Transaction Failed

With this understanding of how proxies work, 
I finally understood my production bug. The issue wasn't with Spring's transaction management—it was with how I was calling my transactional method.

Here's what I had written:

```java
@Service
public class UserService {
    
    public void createUser(User user) {
        // This was the problem!
        this.saveUserInternal(user);
    }
    
    @Transactional
    private void saveUserInternal(User user) {
        userRepository.save(user);
        // Complex logic that could fail
        processUserData(user);
    }
}
```

The problem was the `this.saveUserInternal(user)` call. When I called `this.saveUserInternal()`, I was calling the method on the original object, not the proxy. The proxy never had a chance to intercept the call and start a transaction. So when `processUserData(user)` threw an exception, there was no transaction to roll back.

This discovery led me to uncover several other common proxy traps that had been lurking in our codebase:

The first trap was self-invocation, which was exactly what caused my production bug. Any time you call a method on `this`, you bypass the proxy entirely.

The second trap involved final methods. Since CGLIB proxies work by subclassing, they can't override final methods:

```java
@Service
public class UserService {
    
    @Transactional
    public final void createUser(User user) {  // CGLIB can't proxy this!
        userRepository.save(user);
    }
}
```

The third trap was private methods. Proxies can only intercept public method calls:

```java
@Service
public class UserService {
    
    @Transactional
    private void createUser(User user) {  // This annotation is ignored
        userRepository.save(user);
    }
}
```

## The Solutions That Saved Our Production System

Once I understood these proxy limitations, fixing the issues became straightforward. For the self-invocation problem, I had several options:

I could inject the service into itself, forcing Spring to inject the proxy:

```java
@Service
@Transactional
public class UserService {
    
    @Autowired
    private UserService self;  // This will be the proxy
    
    public void createUser(User user) {
        self.saveUserInternal(user);  // Now goes through the proxy
    }
    
    @Transactional
    public void saveUserInternal(User user) {
        // Transaction will work correctly
    }
}
```

Or I could restructure the code to avoid self-invocation entirely by moving the transactional logic to a separate service.

For the final method problem, the solution was simple: remove the `final` keyword or switch to interface-based proxies.

For private methods, I needed to make them public or protected.

## The Debugging Tools That Illuminate the Darkness

During this investigation, I learned to programmatically check if an object is a proxy:

```java
import org.springframework.aop.framework.AopUtils;

if (AopUtils.isAopProxy(userService)) {
    System.out.println("This is a proxy object");
    System.out.println("Target class: " + AopUtils.getTargetClass(userService));
}
```

These tools transformed proxy behavior from mysterious magic into visible, understandable mechanics.

## The Lasting Impact of Understanding Proxies

Solving that production issue was just the beginning.
Understanding Spring's proxy pattern fundamentally changed how I approach Spring development. 
I now design services with proxy behavior in mind. I structure my code to work with the proxy pattern rather than against it. 
I debug proxy-related issues in minutes rather than hours.

Most importantly, I now understand that Spring's most powerful features aren't 
actually magic—they're elegant implementations of the proxy pattern. 
Every `@Transactional`, `@Cacheable`, and `@Secured` annotation leverages 
the same underlying mechanism: creating a proxy object that intercepts method calls and adds cross-cutting functionality.

This knowledge transforms you from someone who uses Spring features to someone who understands
how they work. And that understanding makes all the difference when things go wrong in production.

## Preventing Future Proxy Pitfalls

To avoid falling into the same traps I encountered, I've implemented several practices in my development workflow. 
First, I installed SonarQube on my local IDE, 
which includes rules that detect common Spring proxy anti-patterns like self-invocation calls and transactional methods that are private or final. 
A nice alternative is SpotBugs with Spring-specific plugins that flag suspicious proxy-related code during development. 

Beyond static analysis, I created custom [ArchUnit](https://www.archunit.org/userguide/html/000_Index.html#_introduction) tests 
in our build pipeline that enforce architectural rules—preventing private `@Transactional` methods and detecting 
self-invocation patterns before they reach production. 

The next time you encounter mysterious Spring behavior—transactions that don't roll back, 
caches that don't clear, security that doesn't enforce—you'll know exactly where to look. 
You'll understand that behind every Spring annotation is a proxy, 
silently working to make your code more powerful than you ever wrote it to be.