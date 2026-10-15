# Reading AI

The server owns question validation, prompts, default models, routing, and quotas. Documents are untrusted source data. Answers cite numbered paragraphs; citations outside the supplied document are discarded. Thread history contains completed turns. Streaming responses report actual model, completion, interruption, and provider errors. The frontend saves completed or interrupted answers and permits retry or deletion.

Inkling is selected initially. Inkling and Nemotron fall back to the Free Model Router through OpenRouter's native ordered model routing. Maximum reasoning effort is requested and mapped to supported provider levels. The owner key is stored in Secret Manager and available only to the request function. Shared requests are limited per identity, IP, and day. Web search is disabled. No search plugin or external search provider is invoked, even if a client supplies a web flag.
