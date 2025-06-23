---
title: How to Configure AI Chat To Query APIs
image: /assets/rag-spring-ai/cover.png
subtitle: With SpringAI and Approximately 50 lines of Code.
layout: post
date: 2024-06-10 16:00:00 +0200
excerpt: In this article, we will implement Function-Calling, another way to customize LLM models to a specific need.
categories:
  - Java
  - RAG
---

#### _With SpringAI and Approximately 50 lines of Code._

In the previous article, we built a [Smart Document Assistant](https://gaetanopiazzolla.github.io/java/rag/2024/05/23/rag-spring-ai.html): 
a simple Retrieval Augmented Generation tool that enriches the data returned by 
the LLM with our documents and the knowledge they provide, using a Vector Database for similarity search.

In this article, we will implement [Function-Calling](https://platform.openai.com/docs/guides/function-calling),
another way to customize LLM models to a specific need.

<div align="center">
<img src="/assets/rag-spring-ai/cover.png" style="content-visibility:auto"
alt="Nice cloud"
loading="lazy"
decoding="async">
</div>
<p style="text-align:center; font-style: italic;">Photo by <a href="https://unsplash.com/@czarotg?utm_source=gae.piaz">Cezary Kukowka</a> on Unsplash</p>

## How It Works

Most recent LLM models have been trained to detect when an input needs data from a 
user-registered function. When this happens, 
the AI returns the text and some additional data in a JSON format. 
The caller then uses this additional Data to call the Function and enriches the text returned by the LLM.

The following diagram illustrates the flow of operations happening during the process.

<div align="center">
<img src="/assets/rag-spring-ai/llm-function-calling-diagram.png" style="content-visibility:auto"
alt="Stupid Diagram"
loading="lazy"
decoding="async">
</div>
<p style="text-align:center; font-style: italic;">LLM Function Calling Diagram</p>

Let’s see an example related to the Smart Document Assistant.

When the user request comes in we first instruct the LLM model (0). We tell the LLM that if someone is searching for documents with specific names, we need additional data from an API, so it has to return a JSON adhering to this API.

Then after we send the request (1) the LLM understands that it needs data from the user-defined function(2), and returns the response with JSON (4). For example:
_“{ “name”: “test.txt” }”_

(4) The JSON is serialized in a Java class, and it’s then used to call the User Function Api _“documentService.findDocument(...)”_. The data returned are then subsequently sent back to the chat model, (5) so that it can elaborate the final response with all the available data (6) example: 
_“There is one document with the specified name”._

For an exhaustive calling flow diagram, check this one: [openai-function-calling-flow.jpg](https://docs.spring.io/spring-ai/reference/_images/openai-function-calling-flow.jpg)

## Code
As we have seen in the previous article, the chat prompt sent to the LLM contains the user message and the system message (with the vector database result documents and the message history) 

{% highlight java %}
Prompt prompt = new Prompt(List.of(systemMessage, userMessage), promptOptions);
{% endhighlight %}

The PromptOptions parameter is built just once during the initialization phase of the Service, and it’s where we can register our custom callback functions.

{% highlight java %}
@Autowired
private FindDocumentsService findDocumentsService;

@Autowired
private Environment environment;

private FunctionCallingOptions promptOptions;

@PostConstruct
public void init() {
    if(!StringUtils.isBlank(environment.getProperty("spring.ai.openai.api-key"))) {
        promptOptions = OpenAiChatOptions.builder()
            .withFunctionCallbacks(List.of(FunctionCallbackWrapper
            .builder(findDocumentsService)
            .withName("FindDocumentsService")
            .withDescription("Retrieve the number of occurrences of 
                documents based on the provided criteria.")
            .withResponseConverter((response) -> "" + response.occurrences())
            .build()))
        .build();
    } else {
        logger.error("no other AI model is available!");
        throw new IllegalStateException("spring.ai.openai.api-key is not set!");
    }
}
{% endhighlight %}

We are using OpenAI in this case, but FunctionCallingOptions 
is available for several LLM models, as we can see from the JavaDoc, 
[the interface](https://docs.spring.io/spring-ai/docs/current-SNAPSHOT/api/org/springframework/ai/model/function/FunctionCallingOptions.html) 
is implemented by various concrete classes (MistralAI, Azure, OpenAI, Vertex).

The Spring Service Component FindDocumentService has been configured as a function callback wrapper, 
and it’s nothing more than a class implementing the standard _java.util.function.Function_ interface 
(it’s a “_Function that accepts one argument and produces a result_”):

{% highlight java %}
@Service
public class FindDocumentsService
implements Function<FindDocumentsService.Request, FindDocumentsService.Response> {

    @Autowired private DocumentService documentService;

    /** Document Function request. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonClassDescription("Find Documents Function Request.")
    public record Request(
            @JsonProperty(required = false, value = "name")
                    @JsonPropertyDescription("The name of the document. 
                        E.G: 'RAG with Spring'")
                    String name,
            @JsonProperty(required = false, value = "greater_than")
                    @JsonPropertyDescription("The size of the document in bytes. 
                        E.G: 1024")
                    Long greaterThan,
            ... ) {}

    /** Document Function response. */
    public record Response(Integer occurrences) {}

    @Override
    public Response apply(Request request) {
        try {
            List<DocumentDTO> documents = documentService.getAll();
            // return documents based on the request .. 
            }
    }
}
{% endhighlight %}

The _JsonClassDescription_ and the _JsonPropertyDescription_ will be used by the LLM model together with the “function description” set in the prompt options, to understand HOW and WHEN it needs to call the function.
It’s also possible to enable or disable the function calling by setting a “_tool-choice_” parameter:

{% highlight java %}
//"none" means the model will not call any function
//"auto" means the model can pick between generating a message or calling a function
if(isFunctionCallEnabled) { 
    promptOptions.setToolChoice(OpenAiApi.
        ChatCompletionRequest.ToolChoiceBuilder.AUTO);
} else {
    promptOptions.setToolChoice(OpenAiApi.
        ChatCompletionRequest.ToolChoiceBuilder.NONE);
}
{% endhighlight %}

It’s even possible to force the model to call a function for every request by specifying a function as “required”.

And that’s it!

This is all we need to configure in an error-safe way the LLM 
to return JSON data that we will use to call our function or an external RestAPI. 
As you might imagine we can do whatever we want once we get the data returned by the LLM. 
We could also perform data updates, not only data retrieval!

There are also several configurations that we can tune for better results as you might imagine, 
such as the Temperature, the Logit Bias, etc: the really good point is that we have an easy-to-use 
library to play with LLM without any boilerplate code, and we can configure them both in line 
(as we did for the _tool choice_) or through the _application.yaml_ file:

{% highlight yaml %}
spring: 
  ai:
    openai:
      api-key: ${OPENAI_API_KEY}
      chat:
        options:
        # The model to use for the chat. possible values are: 
        # gpt-3-turbo, gpt-4-turbo, gpt-4-turbo-preview
        model: gpt-4-turbo-preview
        # The temperature of the model. Must be a float between 0 and 1.
        # Higher values mean the model will take more risks.
        temperature: 0.1
{% endhighlight %}

## Demo
Let’s see the AI LLM function-calling working. Let’s try to send to the chat the following text:

<div align="center">
<img src="/assets/rag-spring-ai/function-start.png" style="content-visibility:auto"
alt="Start query"
loading="lazy"
decoding="async">
</div>
<p style="text-align:center; font-style: italic;">Asking the chat for searching a specific document</p>


As we have discussed already, the prompt will contain the registered FunctionCallback:


<div align="center">
<img src="/assets/rag-spring-ai/prompt-options.png" style="content-visibility:auto"
alt="Prompt debug"
loading="lazy"
decoding="async">
</div>
<p style="text-align:center; font-style: italic;">Debugging the prompt options</p>

Once the LLM model elaborates the request, we will receive the deserialized object ready to use to query our database:

<div align="center">
<img src="/assets/rag-spring-ai/correct-request.png" style="content-visibility:auto"
alt="Correct request"
loading="lazy"
decoding="async">
</div>
<p style="text-align:center; font-style: italic;">Request contains the right parameters</p>

Once the size of the document list is retrieved, the app will return this value to the LLM which will build the final response for us:

<div align="center">
<img src="/assets/rag-spring-ai/function-end.png" style="content-visibility:auto"
alt="End query"
loading="lazy"
decoding="async">
</div>
<p style="text-align:center; font-style: italic;">The final response</p>

## Conclusion

That’s it for this short article. 

Here you can find the public GitHub repository with all the code: 
[https://github.com/GaetanoPiazzolla/smart-document-assistant](https://github.com/GaetanoPiazzolla/smart-document-assistant)

I hope you enjoyed it, thanks for reading!