---
title: Java Exception Anti-Patterns
layout: post
date:   2024-07-01 17:00:00 +0100
categories:
  - Java
  - Exception
  - Patterns
---

Achieve Efficient Maintainable and Simple Java Exception handling killing those anti-patterns.

## The Silencer

{% highlight java %}
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    // ignoring the exception
}
{% endhighlight %}

This anti-pattern is everywhere. 
It’s mostly added in the codebase when fixing a compiler error without using Throws. 
It makes the JVM scream into a pillow.
As a rule of thumb, never catch an exception without logging it, wrapping it, or re-throwing it to the upper level.

## The Exceptional Else Block

AKA [Coding by Exception](https://en.wikipedia.org/wiki/Coding_by_exception). This is opinionated. The definition of exception is: ["_someone or something that is not included in a rule, group, or list or that does not behave in the expected way_"](https://dictionary.cambridge.org/dictionary/english/exception).

{% highlight java %}
public void processFile(String fileName) {
    try {
        File file = new File(fileName);
        // Some operation that might throw FileNotFoundException
        FileReader fileReader = new FileReader(file);
    } catch (FileNotFoundException e) {
        // This is the exceptional else block
        log.info("File not found, creating a new one.");
        createNewFile(fileName);
    }
}
{% endhighlight %}

IMHO It is wrong to consider the case in which the Exception is thrown as a standard flow. 
The exception should be handled, as the name implies, as an exceptional case, typically an error, 
which is something unexpected. The definition of “_exceptional_” is not subjective.
In this case, a better approach would be to check if the file exists before trying to read it.

## The Wrapped Silencer

When wrapping an Exception in a custom one, it is fundamental not to lose the original exception.

{% highlight java %}
public void someMethod() {
try {
        // Some operation that might throw IOException
        FileInputStream fis = new FileInputStream("non_existent_file.txt");
    } catch (IOException e) {
        // Wrapping the exception but not preserving the original one
        throw new CustomRuntimeException("File operation failed.");
    }
}
{% endhighlight %}

In this case, the original exception is lost and upper layers can’t access the stack trace and messages. 
When debugging, this can easily become a nightmare.
When wrapping, always use the [exception constructor](https://docs.oracle.com/javase%2F7%2Fdocs%2Fapi%2F/java/lang/Exception.html#Exception(java.lang.String,%20java.lang.Throwable))
with the “cause” parameter:

{% highlight java %}
throw new CustomRuntimeException("File operation failed.", e)
{% endhighlight %}

## The Stack Trace Polluter

When handling exceptions, **never** log and throw.

{% highlight java %}
public void someMethod() {
    try {
        // Some operation that might throw IOException
        FileInputStream fis = new FileInputStream("non_existent_file.txt");
    } catch (IOException e) {
        // Logging the exception and then re-throwing it
        log.error("An error occurred: " + e);
        throw new RuntimeException(e);
    }
}
{% endhighlight %}

This will pollute the logging with repetitive and useless stack traces. 
Log only what is needed, never log the stack trace more than once. 

## The Useless Wrapper

{% highlight java %}
public void someMethod() {
    try {
        // Some operation that might throw IllegalArgumentException
        int number = Integer.parseInt("not a number");
    } catch (IllegalArgumentException e) {
        // Wrapping the IllegalArgumentException in a custom one
        throw new CustomIllegalArgumentException("Invalid number format.", e);
    }
}
{% endhighlight %}

The Java.Util package defines a series of exceptions e.g. the IllegalArgumentException. 
It’s a best practice to reuse them instead of defining useless wrappers 
that don’t add any functionality or context to the existing ones.

## The Custom Exception Freak

{% highlight java %}
try {
    thisCouldThrowAnException();
}
catch (IllegalCaseOneException | IllegalCaseTwoException | IllegalCaseThreeException e) {
    ...
}
{% endhighlight %}
Having one custom exception for every small exceptional case it’s a bad practice.
It’s way better to adopt the “[error code](https://gaetanopiazzolla.github.io/java/2023/03/05/java-exception-patterns.html)” pattern instead.

## The SneakyThrower (Silencer 2.0)

{% highlight java %}
@SneakyThrows
public void someMethod() {
    // Some operation that might throw a checked exception
    Thread.sleep(1000);
}
{% endhighlight %}

[This Lombok Annotation](https://projectlombok.org/features/SneakyThrows) is a code smell. It’s a way to avoid handling exceptions, but it’s not a good practice. It should be used with a lot of caution.
It’s better to handle exceptions explicitly, because it makes the code more readable and maintainable.

## The Generic Exception Thrower

{% highlight java %}
public void someMethod() throws Exception {
    // Some operation that might throw an exception
}
{% endhighlight %}
This is a bad practice. It’s always better to throw a specific exception,
so the caller can handle it properly. This doesn't give callers of your method
any information about what might have gone wrong. 
The same applies for catching Exception, Throwable, and Error. 
It's important to always catch the most specific exception possible.