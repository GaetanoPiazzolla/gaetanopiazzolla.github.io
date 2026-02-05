---
title: "Sentiment Analysis in Java: Fast and Free"
layout: post
date: 2026-02-05 17:00:00 +0100
image: /assets/sentiment-analysis-java.svg
excerpt: How to implement a fast, free, and highly accurate financial sentiment analysis system using Spring Boot and Deep Java Library (DJL).
categories:
  - Java
  - AI
lang: en

---

In the world of financial technology, sentiment analysis has become a crucial tool for understanding market dynamics and investor behavior. While Large Language Models (LLMs) like GPT-4 can provide excellent sentiment analysis, they come with costs and latency concerns that make them less suitable for high-frequency analysis or applications where speed and cost-effectiveness are paramount.

{% include image.html src="/assets/sentiment-java.png" alt="Sentiment Analysis Java" %}

In this article, we'll explore how to implement a **fast, free, and highly accurate** financial sentiment analysis system using a pre-trained DistilRoBERTa model from Hugging Face, converted to TorchScript, and integrated into a Spring Boot application using the Deep Java Library (DJL).

This is the same approach I used to build **[BullSentiment.com](https://bullsentiment.com)** - a real-time stock sentiment analysis platform that processes thousands of financial news articles daily to provide actionable market insights.

## Repository

The complete source code for this tutorial is available on GitHub:

**[https://github.com/gaetanopiazzolla/sentiment-analysis-java](https://github.com/gaetanopiazzolla/sentiment-analysis-java)**

## Quick Start

If you want to get up and running quickly, here's what you need:

### Prerequisites

- Java 24+ (or adjust `build.gradle.kts` for your version)
- Python 3.10+ (for model conversion only)
- Gradle 8+

### Steps

1. **Clone the repository:**
```bash
git clone https://github.com/gaetanopiazzolla/sentiment-analysis-java.git
cd sentiment-analysis-java
```

2. **Convert the model to TorchScript:**
```bash
cd model-conversion-script
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python3 convert_to_torchscript.py
cd ..
```

3. **Run the application:**
```bash
./gradlew bootRun
```

4. **Test the API:**
```bash
curl "http://localhost:8080/api/sentiment/analyze?text=The%20company%20reported%20record%20profits%20this%20quarter"
```

That's it! You now have a working sentiment analysis API.

## Why Choose This Approach Over LLMs?

While LLMs offer impressive capabilities, our approach provides several key advantages:

- **Speed**: Local model inference is significantly faster than API calls
- **Cost**: Completely free after initial setup - no per-request charges
- **Privacy**: All processing happens locally, no data leaves your infrastructure
- **Consistency**: Deterministic results without the variability of LLM responses
- **Scalability**: No rate limits or API quotas to worry about

## The Model: DistilRoBERTa Fine-tuned for Financial News

We're using the [`mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis`](https://huggingface.co/mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis) model from Hugging Face. This model is specifically fine-tuned on the financial_phrasebank dataset, achieving **98% accuracy** on financial sentiment classification.

The model has 6 layers, 768 dimensions, and 12 heads, totaling 82M parameters. On average, DistilRoBERTa is twice as fast as RoBERTa-base while maintaining excellent accuracy.

## Project Structure

```
sentiment-analysis-java/
├── build.gradle.kts
├── model-conversion-script/
│   ├── convert_to_torchscript.py
│   ├── requirements.txt
│   └── (model files after conversion)
└── src/main/java/gae/piaz/sentiment/
    ├── SentimentAnalysisApplication.java
    ├── config/
    │   └── SentimentModelConfig.java
    ├── controller/
    │   └── SentimentController.java
    └── service/
        └── SentimentAnalyzerService.java
```

## Model Conversion: From Transformers to TorchScript

To use this model with DJL in our Spring Boot application, we need to convert it from the Transformers format to TorchScript. The `convert_to_torchscript.py` script handles this:

```python
import torch
from transformers import RobertaForSequenceClassification, RobertaTokenizer

model_name = "mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis"

# Load the model and tokenizer
tokenizer = RobertaTokenizer.from_pretrained(model_name)
model = RobertaForSequenceClassification.from_pretrained(model_name)
model.eval()

# Create example input for tracing
sample_text = "Operating profit totaled EUR 9.4 mn, down from EUR 11.7 mn in 2004."
inputs = tokenizer(sample_text, return_tensors="pt", padding=True, truncation=True, max_length=512)

# Trace the model
with torch.no_grad():
    traced_model = torch.jit.trace(
        model,
        (inputs["input_ids"], inputs["attention_mask"]),
        strict=False
    )

# Save the traced model
traced_model.save("model.pt")
```

The script also downloads the necessary tokenizer files (`config.json`, `tokenizer.json`, `merges.txt`, `vocab.json`) that DJL needs for text preprocessing.

## Spring Boot Integration

### Gradle Dependencies

The `build.gradle.kts` includes the necessary dependencies:

```kotlin
plugins {
    java
    id("org.springframework.boot") version "3.4.5"
    id("io.spring.dependency-management") version "1.1.7"
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(24)
    }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // DJL (Deep Java Library) for ML inference
    implementation(platform("ai.djl:bom:0.33.0"))
    implementation("ai.djl:api")
    runtimeOnly("ai.djl.pytorch:pytorch-engine")
    implementation("ai.djl.huggingface:tokenizers")
    implementation("ai.djl:model-zoo")
}

tasks.withType<JavaExec> {
    jvmArgs(
        "--sun-misc-unsafe-memory-access=allow",
        "--enable-native-access=ALL-UNNAMED"
    )
}
```

Note the JVM arguments - these are required for DJL to work properly with newer Java versions.

### Application Configuration

The `application.yaml` configuration is minimal:

```yaml
sentiment:
  model-dir: ${MODEL_DIR:model-conversion-script}

logging:
  level:
    gae.piaz.sentiment: INFO
```

The `model-dir` points to the directory containing the converted model files.

### Model Configuration Bean

The `SentimentModelConfig` class initializes the DJL predictor:

```java
@Configuration
public class SentimentModelConfig {

    private static final Logger logger = LoggerFactory.getLogger(SentimentModelConfig.class);

    @Value("${sentiment.model-dir}")
    private String modelDir;

    private ZooModel<String, Classifications> model;

    @Bean
    public Predictor<String, Classifications> sentimentPredictor() {
        try {
            logger.info("Loading DistilRoBERTa financial news sentiment analysis model...");

            Criteria<String, Classifications> criteria = Criteria.builder()
                .setTypes(String.class, Classifications.class)
                .optModelPath(Paths.get(modelDir))
                .optModelName("model.pt")
                .optOption("modelDir", modelDir)
                .optTranslatorFactory(new TextClassificationTranslatorFactory())
                .optProgress(new ProgressBar())
                .build();

            model = criteria.loadModel();
            return model.newPredictor();
        } catch (ModelException | IOException e) {
            throw new RuntimeException("Failed to initialize sentiment analysis model", e);
        }
    }

    @PreDestroy
    public void cleanup() {
        if (model != null) {
            model.close();
        }
    }
}
```

The key components here are:
- `TextClassificationTranslatorFactory` - handles tokenization and output parsing automatically
- `optModelPath` - points to the directory with the model files
- `optModelName` - specifies the TorchScript model file

### Sentiment Analysis Service

The service layer performs the actual inference:

```java
@Service
public class SentimentAnalyzerService {

    private final Predictor<String, Classifications> predictor;

    public SentimentAnalyzerService(Predictor<String, Classifications> predictor) {
        this.predictor = predictor;
    }

    public Double analyzeSentimentSimple(String text) {
        try {
            Classifications result = predictor.predict(text);
            return calculateSentimentScore(result.items());
        } catch (Exception e) {
            return 0.0; // Return neutral sentiment on error
        }
    }

    private double calculateSentimentScore(List<Classifications.Classification> classifications) {
        double positiveScore = 0.0;
        double negativeScore = 0.0;
        double neutralScore = 0.0;

        for (Classifications.Classification classification : classifications) {
            double weight = classification.getProbability();
            String className = classification.getClassName().toLowerCase();

            switch (className) {
                case "positive" -> positiveScore += weight;
                case "negative" -> negativeScore += weight;
                case "neutral" -> neutralScore += weight;
            }
        }

        double totalWeight = positiveScore + negativeScore + neutralScore;
        if (totalWeight == 0.0) return 0.0;

        double pPos = positiveScore / totalWeight;
        double pNeg = negativeScore / totalWeight;
        double pNeu = neutralScore / totalWeight;

        // Score ranges from -1 (negative) to +1 (positive), dampened by neutral
        return (pPos - pNeg) * (1.0 - pNeu);
    }
}
```

The sentiment score is calculated as a value between -1 (fully negative) and +1 (fully positive), with the neutral probability dampening the extremes.

### REST Controller

The controller exposes a simple API:

```java
@RestController
@RequestMapping("/api/sentiment")
@CrossOrigin
public class SentimentController {

    private final SentimentAnalyzerService sentimentAnalyzerService;

    public SentimentController(SentimentAnalyzerService sentimentAnalyzerService) {
        this.sentimentAnalyzerService = sentimentAnalyzerService;
    }

    @GetMapping("/analyze")
    public ResponseEntity<Double> analyzeSentimentSimple(@RequestParam String text) {
        Double sentimentScore = sentimentAnalyzerService.analyzeSentimentSimple(text);
        return ResponseEntity.ok(sentimentScore);
    }
}
```

## Testing the API

Once the application is running, you can test it with various financial texts:

```bash
# Positive sentiment
curl "http://localhost:8080/api/sentiment/analyze?text=The%20company%20reported%20record%20profits%20and%20exceeded%20all%20expectations"
# Returns: ~0.85

# Negative sentiment
curl "http://localhost:8080/api/sentiment/analyze?text=The%20stock%20plummeted%20after%20the%20company%20announced%20massive%20layoffs"
# Returns: ~-0.72

# Neutral sentiment
curl "http://localhost:8080/api/sentiment/analyze?text=The%20company%20held%20its%20annual%20shareholder%20meeting%20yesterday"
# Returns: ~0.05
```

## Performance Comparison: Local Model vs LLMs

| Aspect | Local DistilRoBERTa | GPT-4/Claude |
|--------|-------------------|--------------|
| **Cost** | Free | $0.01-0.06 per 1K tokens |
| **Speed** | ~50-100ms | ~1-3 seconds |
| **Privacy** | Complete | Data sent to provider |
| **Reliability** | 99.9%+ | Depends on API uptime |
| **Accuracy (Financial)** | 98% | Very high but variable |

## Real-World Application: BullSentiment.com

This exact architecture powers **[BullSentiment.com](https://bullsentiment.com)**, where we:

- Process thousands of financial news articles daily
- Provide real-time sentiment scores for stocks
- Correlate sentiment trends with price movements
- Deliver actionable insights to traders and investors

The combination of speed, accuracy, and zero per-request costs makes this approach ideal for high-volume financial analysis applications.

## Conclusion

While LLMs are powerful tools, they're not always the best solution for every problem. For financial sentiment analysis where speed, cost, and privacy are concerns, a well-chosen pre-trained model like DistilRoBERTa can provide excellent results with significant operational advantages.

This approach demonstrates that with the right tools and configuration, you can build a production-ready, enterprise-grade sentiment analysis system that's both fast and free. The combination of Spring Boot, DJL, and a domain-specific model creates a robust foundation for financial technology applications.

The key is understanding your requirements and choosing the right tool for the job. Sometimes, the best solution is simpler than you think.

---

*Interested in seeing this in action? Check out [BullSentiment.com](https://bullsentiment.com) for real-time stock sentiment analysis. The complete source code for this tutorial is available at [github.com/gaetanopiazzolla/sentiment-analysis-java](https://github.com/gaetanopiazzolla/sentiment-analysis-java).*
