---
title: TestContainers with Docker Compose in SpringBoot 3  
layout: post
date:   2024-05-16 08:00:00 +0100
categories:
  - Java
  - Docker
  - SpringBoot
---

## Introduction

In the previous article, we talked about how to use TestContainers with Spring Boot 3.1 to simplify [Integration Testing (I&T)](https://en.wikipedia.org/wiki/Integration_testing).
Going a little bit in-depth, we can use _TestContainers_ with _Docker Compose_ to simplify the testing of more complex scenarios.
In this case we want to test a Spring Boot application that uses a _PostgreSQL_ database initialized with a _Liquibase_ changelog.


<b>We don't want to use an embedded database like H2.</b>

<div align="center">
    <img src="/assets/ceiling.png" style="content-visibility:auto" alt="Ceiling" loading="lazy" decoding="async">
</div>
<p style="text-align:center">Photo by <a href="https://unsplash.com/photos/white-ceiling-with-gold-frame-SMDX3gLEu_M">Carlo Alberto Burato</a> on Unspash</p>

Why? Well, using different database technologies in tests is a common practice, but it can lead to different behaviors 
between tests and production; moreover, even if it's a commonly recognized
best practice to abstract the database used in the application, so that it's easier to switch between different technologies at will, 
everyone with some working experience knows that it's not always possible to avoid using specific database features.


[Database layer abstraction is not always good](https://enterprisecraftsmanship.com/posts/should-you-abstract-database/) - spending days to implement a feature that can be done in a few minutes using a specific database feature is not a good idea. 
YAGNI principle applies here.


Maintenance of tests with different database technologies can be a nightmare when using specific database features.
That's why in this article we'll use _TestContainers_ with _Docker Compose_ to build some solid, reliable, and maintainable tests.
The complete code of the application is here [github.com/GaetanoPiazzolla/testcontainers-docker-compose](https://github.com/GaetanoPiazzolla/springboot-testcontainers-docker-compose).

## The Application

The application is a simple _SpringBoot_ application that uses a _PostgreSQL_ database, 
with a single REST controller that returns a list of users from the database, 
initialized using [Liquibase changelog](https://github.com/GaetanoPiazzolla/springboot-testcontainers-docker-compose/blob/master/liquibase/changelog/db.changelog.xml).

{% highlight xml %}
<databaseChangeLog>
    <changeSet id="1" author="Gaetano">
        <sqlFile path="01_schema.sql"/>
    </changeSet>
    ...
</databaseChangeLog>
{% endhighlight %}


We are using _spring-data-rest_ to expose the repository as a REST service. It's enough to add the following dependency to the project
[build file](https://github.com/GaetanoPiazzolla/springboot-testcontainers-docker-compose/blob/master/build.gradle.kts):

{% highlight kotlin %}
implementation("org.springframework.boot:spring-boot-starter-data-rest")
{% endhighlight %}

Then we can annotate a simple Spring _Repository_ with the [@RepositoryRestResource](https://docs.spring.io/spring-data/rest/docs/current/api/org/springframework/data/rest/core/annotation/RepositoryRestResource.html) 
annotation as follows:

{% highlight java %}
@RepositoryRestResource(collectionResourceRel = "person", path = "person")
public interface PersonRepository extends PagingAndSortingRepository<Person, Integer>, CrudRepository<Person,Integer> {
    Optional<Person> findByEmail(String email);
}
{% endhighlight %}

Then we can expose the repository as a REST service at the following URL: [http://localhost:8080/repository/person](http://localhost:8080/repository/person. 

## Test with TestContainers and Docker Compose
Now let's get to the spicy part. To test the application in the most similar as possible way to the production environment, 
we need to start a _PostgreSQL_ database with the schema initialized by _Liquibase_.
_Docker Compose_ is the perfect tool for this job:

{% highlight yaml %}
services:
    liquibase-test:
        image: liquibase/liquibase:4.27
        depends_on:
        - db-service-test
        command:
        - "update"
    db-service-test:
        image: postgres
...
{% endhighlight %}

But starting _Docker Compose_ manually before a test is not so easy. We need to start the _Docker Compose_ before the test and stop it after the test.
Moreover, we need to wait for the database to be ready and we need to clean up the environment as well:
delete volumes, networks, and containers. With _TestContainers_, all this is done automatically. 

It's enough to add the following dependency to the project 
[build file](https://github.com/GaetanoPiazzolla/springboot-testcontainers-docker-compose/blob/master/build.gradle.kts):

{% highlight kotlin %}
testImplementation("org.springframework.boot:spring-boot-starter-test")
testImplementation("org.springframework.boot:spring-boot-docker-compose")
testImplementation("org.testcontainers:testcontainers")
testImplementation("org.testcontainers:junit-jupiter")
{% endhighlight %}

And here it is a basic integration test using _MockMvc_ that calls the REST service and checks the data in the repository:

{% highlight java %}

public class PersonCrudRepoIntegrationTest extends AbstractIntegrationTest {

    @Test
    public void savePerson() throws Exception {
        Person person = Person.builder()
                .name("John Doe")
                .email("john.doe@gmail.com")
                .age(25).build();

        mockMvc.perform(
                MockMvcRequestBuilders.post("/person")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(person))
        ).andExpect(status().isCreated());

        // check data in repository
        Optional<Person> personInRepo = personRepository.findByEmail(person.getEmail());
        Assertions.assertTrue(personInRepo.isPresent());
        Assertions.assertEquals(person.getName(), personInRepo.get().getName());
        Assertions.assertEquals(person.getEmail(), personInRepo.get().getEmail());
        Assertions.assertEquals(person.getAge(), personInRepo.get().getAge());
    }
}
{% endhighlight %}

The central part of tests is in the _AbstractIntegrationTest_ class, which all Integration Tests should extend:

{% highlight java %}
@ExtendWith(SpringExtension.class)
@SpringBootTest(classes = SpringBootApp.class)
@AutoConfigureMockMvc
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class AbstractIntegrationTest {

    static {
        File dockerComposeFile = new File("src/test/docker-compose.yml");
        
        DockerComposeContainer<?> container = new DockerComposeContainer<>(dockerComposeFile)
            .withExposedService("db-service-test", 5432)
            .waitingFor(
                    "liquibase-test",
                    Wait.forLogMessage(
                                    ".*Liquibase command 'update' was executed successfully.*\\n",
                                    1)
                            .withStartupTimeout(java.time.Duration.ofMinutes(1)))
            .withRemoveImages(DockerComposeContainer.RemoveImages.LOCAL);

        container.start();
    }
}
{% endhighlight %}

The _AbstractIntegrationTest_ class starts the _Docker Compose_ before the tests and stops it after the tests.
It waits for the Liquibase command to be executed successfully and then it removes the images from the local docker registry.
The test is very simple, but it's a good starting point for building more complex ones; moreover is a good way 
for how to test _Liquibase_ changelog and the database schema itself.


Thank you for reading this small tutorial, I hope you enjoyed it. 
