---
title: Multi-Layer Cache in Spring Boot
layout: post
date: 2025-01-27 16:00:00 +0100
categories:
  - Java
---

In this article, we'll explore the concept of multi-layer caching in Spring Boot applications.

In particular, we will use a **local first level cache (L1) with a shorter duration** and a 
**remote and distributed second level cache (L2) with a longer duration**.

The general concept is to use a local cache first, and a second level cache if the data is not found in the first one.

The goal is to improve the application's performance by reducing the number of round trips to remote hosts.

---

<div align="center">
    <img src="/assets/cache.jpg" style="content-visibility:auto" alt="Meme" loading="lazy" decoding="async">
</div>

---

**The first-level cache** will be provided by [Caffeine](https://github.com/ben-manes/caffeine), a high-performance caching library.

**The second-level cache** will be provided by [Redis](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html), a popular in-memory data structure store. 

Of course, this implementation is made to be generic and can be easily adapted to other caching libraries.

The code is available [here](https://github.com/GaetanoPiazzolla/spring-boot-multi-layer-cache).

---

## Dumb (and Easy) Approach to Double Caching

With Spring Boot, we can use the `@Cacheable` annotation to cache the results of a method. 

To implement a second-level cache,
we can manually check if the data is present in the first level caffeine cache, 
and if not, check the second level cache.

Here is an example of a method that uses the `@Cacheable` annotation:

```java

public L2CacheService {

    @Cacheable(value = "myCache", key = "#id")
    public String getFromCache(String id) {
        // This method will be cached
        return "Hello " + id;
    }
}
```

To implement the multi-layer caching, we can use the following approach:

```java

public L1CacheService {

    @Autowired
    private L2CacheService l2CacheService;

    private Cache<String, String> caffeineCache = Caffeine.newBuilder()
        .maximumSize(100)
        .expireAfterWrite(10, TimeUnit.MINUTES)
        .build();

    public String getFromCache(String id) {
        String result = caffeineCache.getIfPresent(id);
        if (result == null) {
            result = l2CacheService.getFromCache(id);
            if (result != null) {
                caffeineCache.put(id, result);
            }
        }
        return result;
    }
}
```

MEH. This is not a good approach. It's super verbose and error-prone. We have to create a new service for each cache level.
We can do better.

---

## Using Spring Cache Abstraction

By using the Spring [CompositeCacheManager](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/support/CompositeCacheManager.html) 
to combine the two caches, we can simplify the code big time:

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager caffeineCacheManager = new CaffeineCacheManager("myCache");
        caffeineCacheManager.setCaffeine(caffeineCacheBuilder());
        caffeineCacheManager.setAllowNullValues(false);

        RedisCacheManager redisCacheManager = new RedisCacheManager(redisTemplate());
        redisCacheManager.setUsePrefix(true);

        CompositeCacheManager compositeCacheManager = new CompositeCacheManager(caffeineCacheManager, redisCacheManager);
        compositeCacheManager.setFallbackToNoOpCache(true);

        return compositeCacheManager;
    }

    private Caffeine<Object, Object> caffeineCacheBuilder() {
        return Caffeine.newBuilder()
            .maximumSize(100)
            .expireAfterWrite(10, TimeUnit.MINUTES);
    }

    @Bean
    public RedisTemplate<String, String> redisTemplate() {
        RedisTemplate<String, String> redisTemplate = new RedisTemplate<>();
        redisTemplate.setConnectionFactory(redisConnectionFactory());
        redisTemplate.setKeySerializer(new StringRedisSerializer());
        redisTemplate.setValueSerializer(new StringRedisSerializer());
        return redisTemplate;
    }

    @Bean
    public RedisConnectionFactory redisConnectionFactory() {
        return new LettuceConnectionFactory();
    }
}
```

Then we just need to simply annotate our service method with `@Cacheable`:
    
```java
@Cacheable(value = "myCache", key = "#id")
public String getFromCache(String id) {
    return "Hello " + id;
}
```


Under the hood, the `CompositeCacheManager` will check the first cache, and if the data is not found, it will check the second cache.
This approach is more robust and less error-prone than the previous one.
But it has some limitations.

**PROBLEM: If the data is not found in the first cache, the `CompositeCacheManager` will check the second cache, 
but it will not store the data in the first cache.**

To ensure that both Caffeine and Redis caches are populated, 
we need to configure the caching logic to explicitly write to both caches. 
Unfortunately, this cannot be achieved purely through configuration with the `CompositeCacheManager`. 

We will need to implement custom logic in your service methods to handle this:

```java
public String getFromCache(String id) {
    String result = caffeineCacheManager.getCache("myCache").get(id, String.class);
    if (result == null) {
        result = redisCacheManager.getCache("myCache").get(id, String.class);
        if (result != null) {
            caffeineCacheManager.getCache("myCache").put(id, result);
        }
    }
    return result;
}
```

So it's not a perfect solution because it still requires manual intervention in the service methods.

Let's see how we can improve this.

---
## Using a Custom CacheManager

We can implement our own, custom `CacheManager` to handle the double caching logic.


```java
import org.springframework.cache.CacheManager;
import org.springframework.cache.Cache;

public class CustomCacheManager implements CacheManager {

    private CacheManager caffeineCacheManager;
    private CacheManager redisCacheManager;

    public CustomCacheManager(CacheManager caffeineCacheManager, CacheManager redisCacheManager) {
        this.caffeineCacheManager = caffeineCacheManager;
        this.redisCacheManager = redisCacheManager;
    }

    @Override
    public Cache getCache(String name) {
        Cache caffeineCache = caffeineCacheManager.getCache(name);
        Cache redisCache = redisCacheManager.getCache(name);
        return new CustomCache(caffeineCache, redisCache);
    }

    @Override
    public Collection<String> getCacheNames() {
        return caffeineCacheManager.getCacheNames();
    }
}
```

As you can see, the Cache returned by the `CustomCacheManager` will be a `CustomCache`:

```java
import java.util.concurrent.Callable;
import org.springframework.cache.Cache;

public record CustomCache(Cache firstLevelCache, Cache secondLevelCache) implements Cache {

    @Override
    public String getName() {
        return firstLevelCache.getName();
    }

    @Override
    public Object getNativeCache() {
        return firstLevelCache.getNativeCache();
    }

    @Override
    public ValueWrapper get(Object key) {
        ValueWrapper value = firstLevelCache.get(key);
        if (value == null) {
            value = secondLevelCache.get(key);
            if (value != null) {
                firstLevelCache.put(key, value.get());
            }
        }
        return value;
    }

    @Override
    public <T> T get(Object key, Class<T> type) {
        T value = firstLevelCache.get(key, type);
        if (value == null) {
            value = secondLevelCache.get(key, type);
            if (value != null) {
                firstLevelCache.put(key, value);
            }
        }
        return value;
    }

    @Override
    public <T> T get(Object key, Callable<T> valueLoader) {
        try {
            return firstLevelCache.get(key, valueLoader);
        } catch (Exception e) {
            return secondLevelCache.get(key, valueLoader);
        }
    }

    @Override
    public void put(Object key, Object value) {
        firstLevelCache.put(key, value);
        secondLevelCache.put(key, value);
    }

    @Override
    public void evict(Object key) {
        firstLevelCache.evict(key);
        secondLevelCache.evict(key);
    }

    @Override
    public void clear() {
        firstLevelCache.clear();
        secondLevelCache.clear();
    }
}
```

And finally, the cache configuration:

```java
@Configuration
@EnableCaching
public class CacheConfig {

    public static final String CACHE_NAME = "doubleCachingCache";

    @Bean
    public CacheManager customCacheManager(RedisConnectionFactory redisConnectionFactory) {

        // Local Cache with Caffeine
        CaffeineCacheManager caffeineCacheManager = new CaffeineCacheManager();
        caffeineCacheManager.setCaffeine(
                Caffeine.newBuilder()
                        .maximumSize(100) // Maximum items in local cache
                        .expireAfterWrite(Duration.ofMinutes(10)) // Expiration time for local cache
                );

        // Distributed Cache with Redis
        RedisCacheManager redisCacheManager =
                RedisCacheManager.builder(redisConnectionFactory)
                        .cacheDefaults(
                                RedisCacheConfiguration.defaultCacheConfig()
                                        .entryTtl(
                                                Duration.ofHours(
                                                        1))) // Expiration time for Redis cache
                        .build();

        // Custom Cache Manager
        return new CustomCacheManager(caffeineCacheManager, redisCacheManager);
    }
}
```

Now we can use the `@Cacheable` annotation as usual:

```java
@Cacheable(value = "anyString", key = "#id")
public String getFromCache(String id) {
    return "Hello " + id;
}
```

And the `CustomCacheManager` will handle the double caching logic for us.

It will first check the local cache, and if the data is not found, it will check the Redis cache.
If the data is found in the Redis cache, it will be stored in the local cache.
When the data is evicted from the local cache, it will also be evicted from the Redis cache.

The complete flow of operations is shown in the following Mermaid diagram:

---

<div align="center">
    <img src="/assets/mermaid-cache.png" style="content-visibility:auto" alt="mermaid cache" loading="lazy" decoding="async">
</div>

---

### Testing

To test the double caching, let's use `TestContainers` as explained 
in [this article](https://gaetanopiazzolla.github.io/java/docker/springboot/2023/05/27/springboot-tc.html) 
to start a Redis container and run the tests.

```java
@Configuration
public class TestContainerConfig {

    public static final DockerImageName REDIS_IMAGE = DockerImageName.parse("redis:5.0.3-alpine");

    @Bean
    @ServiceConnection(name = "redis")
    public RedisContainer redisContainer() {

        final long memoryInBytes = 32L * 1024L * 1024L;
        final long memorySwapInBytes = 64L * 1024L * 1024L;

        return new RedisContainer(REDIS_IMAGE)
                .withExposedPorts(6379)
                .withReuse(true)
                .withCreateContainerCmdModifier(
                        cmd -> {
                            cmd.withName("redis");
                            cmd.getHostConfig()
                                    .withMemory(memoryInBytes)
                                    .withMemorySwap(memorySwapInBytes);
                        });
    }

    class RedisContainer extends GenericContainer<RedisContainer> {
        public RedisContainer(DockerImageName image) {
            super(image);
        }
    }
}
```

Then we can write a test to check the double caching logic:

```java
@SpringBootTest
class MultiCacheAppIntegrationTest {

    @Autowired private CustomCacheManager cacheManager;

    @Autowired private DataService dataService;

    @Test
    void testMultiLayerCache() {
        String id = UUID.randomUUID().toString();

        // Step 1: Call the service method
        String result = dataService.getData(id);
        assertThat(result).isNotNull();

        // Step 2: Verify the value is in Caffeine cache and in Redis cache
        CustomCache customCache = (CustomCache) cacheManager.getCache(CacheConfig.CACHE_NAME);

        CaffeineCache firstLevelCache = (CaffeineCache) customCache.firstLevelCache();
        assertThat(firstLevelCache.get(id).get()).isEqualTo(result);

        RedisCache secondLevelCache = (RedisCache) customCache.secondLevelCache();
        assertThat(secondLevelCache.get(id).get()).isEqualTo(result);

        // Step 3: After clearing up the Caffeine cache,
        // Verify the value is still the same
        firstLevelCache.clear();
        assertThat(firstLevelCache.get(id)).isNull();
        String result2 = dataService.getData(id);
        assertThat(result2).isEqualTo(result);

        // Step 4: Verify the value is again in both caches and in Redis cache
        assertThat(firstLevelCache.get(id).get()).isEqualTo(result);
        assertThat(secondLevelCache.get(id).get()).isEqualTo(result);

        // Step 5: Insert new data
        String newData = UUID.randomUUID().toString();
        dataService.insertData(id, newData);

        // Step 6: Verify both caches are now evicted
        assertThat(firstLevelCache.get(id)).isNull();
        assertThat(secondLevelCache.get(id)).isNull();
    }
}
```

---

### Conclusion

Here’s a quick comparison of the approaches:

- Dumb approach: Manually manages both caches in the service layer but is error-prone and verbose.
- CompositeCacheManager: Simplifies management using Spring’s abstraction but lacks the flexibility to sync both caches properly.
- Custom CacheManager: Offers full control and seamless integration of both caching layers, providing the best balance of simplicity and flexibility. 

**Plus**: you can plug in any caching technologies you want — Redis, Hazelcast, Ehcache, etc.—to build a cache solution tailored to your needs.

For complete code examples, check out the GitHub [repository]((https://github.com/GaetanoPiazzolla/spring-boot-multi-layer-cache)). 🚀

Thank you very much for reading. I hope you enjoyed this article. If you have any questions or feedback, please let me know.
Drop me an email, send me a message on LinkedIn, or whatever you prefer. 
I'm always happy to hear from you.




