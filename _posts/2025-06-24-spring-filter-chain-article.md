---
title: How Spring Implements the Chain of Responsibility Pattern
layout: post
date: 2025-06-24 16:00:00 +0100
image: /assets/chain-of-resp.png
excerpt: A fascinating exploration of one of Spring's most elegant design patterns.
categories:
  - Java
---

Three months ago, I was tasked with implementing logging, authentication, and CORS handling for our Spring Boot API. What seemed straightforward turned into a fascinating exploration of one of Spring's most elegant design patterns.

The breakthrough came when I realized that Spring's filter mechanism is a masterful implementation of the [Chain of Responsibility pattern](https://refactoring.guru/design-patterns/chain-of-responsibility) — a behavioral design pattern where a request passes through a chain of handlers, each having the opportunity to process the request or pass it to the next handler. In Spring's web layer, this pattern enables multiple filters to collaborate seamlessly without knowing about each other.

<div class="post-image-container">
    <img src="/assets/chain-of-resp.png" class="post-image" alt="Some guys passing stuff around" loading="lazy" decoding="async">
</div>

## The Mystery of the Missing Request Headers

My journey began with a simple problem. Our API was inconsistently processing requests—sometimes CORS headers were missing, other times authentication failed silently, and occasionally audit logs were incomplete. Each individual filter worked perfectly in isolation.

I spent days debugging individual filters, convinced the logic was flawed. But when I traced actual HTTP requests through our application, I discovered something unexpected: the order in which filters executed was completely different from what I had assumed.

That's when I realized I was thinking about filters all wrong. I was treating them as independent components, but Spring was treating them as links in a chain—a carefully orchestrated sequence where each filter can transform the request, short-circuit the process, or pass control to the next link.

## Discovering the Chain of Responsibility Pattern

The Chain of Responsibility pattern solves a fundamental problem: how do you allow multiple handlers to process a request without tightly coupling them together? The pattern works by giving each handler a reference to the next handler in the chain.

In Spring's filter implementation, this manifests as the `FilterChain` interface. Every filter receives the request, response, and a `FilterChain` instance representing the rest of the pipeline. This allows each filter to make a crucial decision: process the request and continue the chain, or stop processing entirely.

```java
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {
    
    @Override
    protected void doFilterInternal(ServletRequest request, ServletResponse response, 
                        FilterChain chain) throws IOException, ServletException {
        
        // Pre-processing: what happens before the request continues
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        System.out.println("Incoming request: " + httpRequest.getRequestURI());
        
        // The crucial decision: continue the chain
        chain.doFilter(request, response);
        
        // Post-processing: what happens after the chain returns
        System.out.println("Request completed: " + httpRequest.getRequestURI());
    }
}
```

The magic happens in that `chain.doFilter(request, response)` call. This passes control to the next filter but also represents a return point—when the rest of the chain completes, execution returns to this filter for post-processing.

## The Anatomy of a Request's Journey

To understand how this chain works, I traced a single request through our application. What I discovered was sophisticated orchestration that happens on every HTTP request.

When a request arrives, it doesn't go directly to our controller. Instead, it enters a carefully constructed chain of filters, each with a specific responsibility. The first filter might handle CORS headers, the second might authenticate the user, the third might log request details.

Here's the fascinating part: the chain doesn't just process the request going in—it also processes the response coming back out. Each filter gets two opportunities to modify the HTTP exchange.

```java
@Component
@Order(1)
public class CorsFilter extends OncePerRequestFilter {
    
    @Override
    protected void doFilterInternal(ServletRequest request, ServletResponse response, 
                        FilterChain chain) throws IOException, ServletException {
        
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        
        // Pre-processing: Add CORS headers
        httpResponse.setHeader("Access-Control-Allow-Origin", "*");
        httpResponse.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
        
        // Continue the chain
        chain.doFilter(request, response);
        
        // Post-processing: Could modify response headers here
        httpResponse.setHeader("X-Processed-By", "CorsFilter");
    }
}

@Component
@Order(2)
public class AuthenticationFilter extends OncePerRequestFilter {
    
    @Override
    protected void doFilterInternal(ServletRequest request, ServletResponse response, 
                        FilterChain chain) throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String token = httpRequest.getHeader("Authorization");
        
        if (token == null || !isValidToken(token)) {
            // Short-circuit the chain - don't call chain.doFilter()
            HttpServletResponse httpResponse = (HttpServletResponse) response;
            httpResponse.setStatus(HttpStatus.UNAUTHORIZED.value());
            return;
        }
        
        // Authentication successful, continue the chain
        chain.doFilter(request, response);
    }
}
```

The request flows: Client → CorsFilter → AuthenticationFilter → Controller. The response flows back in reverse: Controller → AuthenticationFilter → CorsFilter → Client. Each filter participates in both directions.

## The Power of Conditional Chain Processing

What makes the Chain of Responsibility pattern so powerful is the ability to conditionally short-circuit the chain. This became crucial when implementing rate limiting.

```java
@Component
@Order(3)
public class RateLimitFilter extends OncePerRequestFilter {
    
    @Override
    protected void doFilterInternal(ServletRequest request, ServletResponse response, 
                        FilterChain chain) throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String clientIp = getClientIp(httpRequest);
        
        if (!rateLimitService.isAllowed(clientIp)) {
            // Short-circuit: don't continue the chain
            HttpServletResponse httpResponse = (HttpServletResponse) response;
            httpResponse.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            return; // Chain stops here
        }
        
        // Rate limit check passed, continue processing
        chain.doFilter(request, response);
        
        // Post-processing: update rate limit counters
        rateLimitService.recordRequest(clientIp);
    }
}
```

The beauty is that the rate limiting filter doesn't need to know about authentication, CORS, or logging. It just makes a binary decision: should this request continue or not? If not, it simply doesn't call `chain.doFilter()`, bypassing the entire rest of the pipeline.

## The Ordering Challenge That Nearly Broke Everything

The most critical aspect of implementing the Chain of Responsibility pattern with Spring filters is getting the order right. This is where I made my biggest mistake initially.

I assumed Spring would automatically order filters based on logical dependencies. But Spring's default ordering is based on component scanning order, which is essentially random.

The solution: Spring's `@Order` annotation and understanding filter precedence.

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)  // -2147483648
public class CorsFilter extends OncePerRequestFilter { /* ... */ }

@Component
@Order(-100)
public class AuthenticationFilter extends OncePerRequestFilter { /* ... */ }

@Component
@Order(-50)
public class AuthorizationFilter extends OncePerRequestFilter { /* ... */ }

@Component
@Order(0)
public class AuditLoggingFilter extends OncePerRequestFilter { /* ... */ }

@Component
@Order(Ordered.LOWEST_PRECEDENCE)  // 2147483647
public class ResponseCompressionFilter extends OncePerRequestFilter { /* ... */ }
```

This ensures CORS headers are always added first, authentication happens before authorization, and response compression happens last. The order applies to both request processing (top to bottom) and response processing (bottom to top).

## The Debugging Breakthrough

Understanding the Chain of Responsibility pattern revolutionized how I debug request processing issues. Instead of tracing individual components, I learned to visualize the entire chain and identify where requests might be getting short-circuited.

I created a diagnostic filter that logs complete chain execution:

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class ChainDiagnosticFilter extends OncePerRequestFilter {
    
    @Override
    protected void doFilterInternal(ServletRequest request, ServletResponse response, 
                        FilterChain chain) throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String requestId = UUID.randomUUID().toString().substring(0, 8);
        
        logger.info("[{}] Request entering chain: {} {}", 
                   requestId, httpRequest.getMethod(), httpRequest.getRequestURI());
        
        long startTime = System.currentTimeMillis();
        
        try {
            chain.doFilter(request, response);
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            logger.info("[{}] Request exiting chain: {} ms, status: {}", 
                       requestId, duration, ((HttpServletResponse) response).getStatus());
        }
    }
}
```

This revealed patterns I had never noticed—requests failing in unexpected places, performance bottlenecks in specific filters, and subtle ordering issues that only manifested under certain conditions.

## The Architecture That Emerged

Once I understood how Spring's filter chain implements the Chain of Responsibility pattern, our entire request processing architecture became clear and maintainable. Each filter has a single responsibility, they're loosely coupled through the chain interface, and they can be easily reordered or replaced.

The pattern also enabled sophisticated scenarios that would have been difficult otherwise. Our security filter can authenticate a user and store the context, which later filters use for authorization decisions, without any direct coupling.

```java
@Component
@Order(-90)
public class SecurityContextFilter extends OncePerRequestFilter {
    
    @Override
    protected void doFilterInternal(ServletRequest request, ServletResponse response, 
                        FilterChain chain) throws IOException, ServletException {
        
        Authentication auth = extractAuthentication(request);
        
        if (auth != null) {
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}

@Component
@Order(-80)
public class AuthorizationFilter extends OncePerRequestFilter {
    
    @Override
    protected void doFilterInternal(ServletRequest request, ServletResponse response, 
                        FilterChain chain) throws IOException, ServletException {
        
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        
        if (auth == null || !hasRequiredPermissions(auth, request)) {
            ((HttpServletResponse) response).setStatus(HttpStatus.FORBIDDEN.value());
            return;
        }
        
        chain.doFilter(request, response);
    }
}
```

## Preventing Common Chain of Responsibility Pitfalls

Through experience implementing and debugging filter chains, I've identified several practices that prevent common issues. 

I implemented integration tests that verify filter execution order using a test filter that records the sequence. 

Most importantly, I learned to always include proper exception handling in filters. Unlike controllers, uncaught exceptions in filters can break the entire chain and leave the HTTP response inconsistent.

I enable filter debugging in test environments (`logging.level.org.springframework.web.filter=DEBUG`) to verify that the chain executes in expected order and that no filters inadvertently short-circuit the process.

## The Deeper Understanding

What started as a simple task became a deep dive into one of Spring's most elegant design pattern implementations. The Chain of Responsibility pattern in Spring filters doesn't just solve request processing—it creates a flexible, maintainable architecture where cross-cutting concerns can be cleanly separated and composed.

Understanding this pattern changed how I think about web application architecture. Instead of cramming all request processing logic into controllers, I now design applications with clear separation of concerns implemented through the filter chain. Authentication, authorization, logging, rate limiting, and data transformation each get their own filter, connected through the chain interface.

The next time you see a `FilterChain` parameter in a Spring filter, you'll understand that you're looking at more than just a method call—you're seeing a link in a carefully orchestrated chain of responsibility that transforms every HTTP request. Each `chain.doFilter()` call represents a decision point where your filter can either trust the rest of the chain or take control itself.

This understanding transforms filter development from a mysterious art into a predictable science, where complex request processing pipelines become as clear and maintainable as any other well-designed software system.

## Further reading

A related intriguing story: [how Spring applies the Proxy Design Pattern](https://gaetanopiazzolla.github.io/java/2025/06/23/proxy-pattern-spring.html)

___

_Disclaimer: This article was written with a small aid of LLMs (Claude and ChatGPT)_
