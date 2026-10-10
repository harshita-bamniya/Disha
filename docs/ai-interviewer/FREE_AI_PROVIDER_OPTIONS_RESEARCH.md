# Free / low-cost AI provider options for the AI interviewer (research)

Date of research: 2026-10-10. Method: WebFetch of official pages; each fact is tagged **[read]** (read on the official page at the URL given), **[snippet]** (only seen in a search-result summary or third-party page; do not rely on it), or **not found**. The fetch tool summarises pages with a small model, so quotes below are as returned by it; re-check the live page before signing anything. Prices are USD unless INR is shown. Nothing here is legal advice.

## 0. Key takeaways

1. **No free tier is acceptable for real candidate data except possibly where the vendor says it does not train and does not retain** (and even then DPDP consent/processor terms apply). Google's free Gemini tier explicitly uses content for training and allows human review.
2. **Free capacity is tiny** (a handful of interviews per day for LLMs). Free tiers are for dev/testing with synthetic data only.
3. **Paid is cheap.** About $0.015-0.02 per 15-min interview on Groq paid (gpt-oss + Whisper turbo), about $0.052 with Gemini paid. 1,000 interviews/month is roughly $15-50. Paying removes the free-tier data-use problem. That is the real answer.
4. Several providers have changed since earlier assumptions: **GitHub Models is retired**; **Cerebras "free" is a $5 / 30-day trial**; **Gemini no longer publishes free-tier numbers on its docs page**.

## 1. LLM providers

### Google Gemini API
- Free tier exists: **yes** for Flash/Flash-Lite/2.5 Pro and TTS/transcribe models per https://ai.google.dev/gemini-api/docs/pricing **[read]** (3.1 Pro Preview: "No").
- Limits: the rate-limit page (https://ai.google.dev/gemini-api/docs/rate-limits) **[read]** publishes **no numbers**; says limits "can be viewed in Google AI Studio", depend on tier, and are "not guaranteed". Third-party pages claim 5-15 RPM, 100-1,500 RPD **[snippet only, sources disagree]**. Exact RPM/RPD/TPM: **not found** officially.
- Training/human review **[read]** https://ai.google.dev/gemini-api/terms, "Unpaid Services": "Google uses the content you submit to the Services and any generated responses to provide, improve, and develop"; "human reviewers may read, annotate, and process your API input and output"; "Do not submit sensitive, confidential, or personal information to the Unpaid Services." Pricing page: free = "Content used to improve our products", paid = "Content **not** used to improve our products".
- EEA/UK/CH: "You may use only Paid Services when making API Clients available to users in the European Economic Area." Must be 18+.
- Retention for unpaid prompts: no fixed period stated in the terms text read (not found).
- Commercial use on free tier: not prohibited in the text read, but the "no personal information" clause makes it unusable for candidate data.
- Region/India latency: not found. JSON schema/structured output: not checked on this pass (Gemini documents it; not verified here).
- Paid step-up **[read]** pricing page, per 1M tokens in/out: 2.5 Flash-Lite $0.10/$0.40; 2.5 Flash $0.30/$2.50; 3.1 Flash-Lite $0.25/$1.50; 3.5 Flash-Lite $0.30/$2.50; 3.6/3.8 Flash $0.75/$3.75 through 2026-12-31 then $1.50/$7.50; 2.5 Pro $1.25/$10. Audio: Gemini 3.5 Transcribe $0.003/min; 2.5 Flash audio input $1.00/M tokens. TTS: 3.8 Flash-Lite TTS $0.50 text-in / $6.00 audio-out per M (through 2026-12-31); 3.8 Flash TTS $0.50/$9.00; 3.1 Flash TTS Preview $1.00/$20.00.
- Hindi quality: not documented on pages read.

### Groq
- Free tier: the official limits page (https://console.groq.com/docs/rate-limits) **[read]** labels its table "base limits for the Developer plan" and says exact limits for your org are in the console "Limits" page. Table: gpt-oss-120b and gpt-oss-20b **30 RPM, 1K RPD, 8K TPM, 200K TPD**; whisper-large-v3-turbo / v3 **20 RPM, 2K RPD, 7.2K audio-sec/hour, 28.8K audio-sec/day**; Orpheus TTS 10 RPM / 100 RPD / 1.2K TPM / 3.6K TPD. Whether this is exactly the Free plan: **not confirmed** (page defers to console). Third parties disagree (200K-500K TPD, 1K-14.4K RPD) **[snippet only]**. This matches the owner's observation (~3 interviews/day).
- Data: https://console.groq.com/docs/your-data **[read]**: "By default, Groq does not retain customer data for inference requests." Reliability/abuse logs up to 30 days (opt-out in Data Controls); "All customers may enable Zero Data Retention (ZDR) in Data Controls settings." **Training on customer data: the page does not say** (not found; check Groq ToS/DPA).
- Commercial use on free tier: not found. Data residency / India latency: not found.
- Paid **[read]** https://console.groq.com/docs/models: gpt-oss-120b $0.15/$0.60 per M; gpt-oss-20b $0.075/$0.30; context 131,072; whisper-large-v3-turbo $0.04/hour; whisper-large-v3 $0.111/hour. (groq.com/pricing returned no figures.) Minimum billed audio per request: not found.
- Structured output / JSON schema: not checked here. Whisper turbo Hindi accuracy: not documented on pages read.

### OpenRouter (:free models)
- https://openrouter.ai/docs/api-reference/limits **[read]**: `:free` variants **20 RPM**; **50 requests/day** if <10 credits ever purchased, **1,000/day** if >=10 credits purchased.
- https://openrouter.ai/docs/features/privacy-and-logging **[read]**: "If you opt out of training in your account settings, OpenRouter will not route to providers that train." Providers have their own retention policies; "separate settings for paid and free models". Per-provider table not rendered. Free-model providers commonly log/train (generic knowledge, unverified).
- Which `:free` models exist today and their context: **not found** (models page showed none). Paid pass-through; structured-output support varies per model/provider (not verified).

### Cerebras
- https://inference-docs.cerebras.ai/support/rate-limits **[read]** "free trial": gpt-oss-120b and qwen-3.8-27b **5 RPM, 30K uncached TPM / 90K total TPM, 1M TPH, 1M TPD**; RPD not listed; context on free not stated.
- https://www.cerebras.ai/pricing **[read]**: not a perpetual free tier: **one-time $5 promotional credit when a payment method is added, expires 30 days after activation**; footnote: "For development, evaluation, and experimentation; not intended for production use." Paid prices and data/training terms: **not found** on the page.

### Mistral (La Plateforme "Experiment")
- Tier docs URL (docs.mistral.ai/deployment/laplateforme/tier/) returned 404. mistral.ai/pricing **[read]** shows no free API tier; only Free *plan* with "limited access to Vibe" and Studio. Mistral Large $0.5/$1.5 per M. Free-tier limits and the training terms for the Experiment tier: **not found / not verified** (do not assume).

### Cloudflare Workers AI
- https://developers.cloudflare.com/workers-ai/platform/pricing/ **[read]**: **10,000 Neurons/day free**, reset 00:00 UTC; $0.011 per 1,000 Neurons above on Workers Paid. gpt-oss-120b $0.35/$0.75 per M (31,818/68,182 neurons per M in/out); gpt-oss-20b $0.20/$0.30 (18,182/27,273); Llama 3.3 70B fp8-fast $0.293/$2.253; whisper-large-v3-turbo $0.0005/audio min (46.63 neurons/min); melotts $0.0002/min; Deepgram Aura-2-en $0.030/1k chars (English only listed). Context limits, data/training terms, Hindi quality: **not found**.

### NVIDIA NIM / build.nvidia.com
- https://build.nvidia.com/faq returned 404. Free credits, limits, production terms: **not found**. (Commonly described as prototyping-only; unverified.)

### GitHub Models
- https://docs.github.com/en/github-models/prototyping-with-ai-models **[read]**: "As of July 30, 2026, GitHub Models has been fully retired." Not an option.

### Hugging Face Inference Providers
- https://huggingface.co/docs/inference-providers/pricing **[read]**: Free users: **no monthly credits** (credit purchase required); PRO $2.00/month credits; pass-through provider prices, no markup.

### Together / Fireworks / SambaNova
- Together https://www.together.ai/pricing **[read]**: no free credits listed; gpt-oss-120B $0.15/$0.60; Llama 3.3 70B $1.04/$1.04; Whisper Large v3 $0.0015/min (table labelled Batch, ambiguous). gpt-oss-20B serverless: not listed.
- Fireworks https://fireworks.ai/pricing **[read]**: prepaid credits, no free credit mentioned; serverless gpt-oss and STT prices not listed in the page text.
- SambaNova https://cloud.sambanova.ai/plans **[read]**: "Free" plan still says "Add a payment method and purchase credits"; free limits: not stated.

### Sarvam AI (India)
- https://docs.sarvam.ai/api-reference-docs/getting-started/pricing **[read]**: new users get **Rs 100 free credits**, never expire. The pricing page https://www.sarvam.ai/api-pricing says free credits exist but amount not stated (so Rs 100 is from the docs page only). Starter limits: STT 60 req/min, TTS 60 (bulbul:v3 30), chat 60 (sarvam-105b 40).
- Prices **[read]** api-pricing: STT Rs30/hour (Rs45 with diarization); Bulbul v3 TTS Rs3 per 1,000 chars; Sarvam 105B Rs29.28 in / Rs73.20 out per M tokens (cached Rs10.98); Gemma-4 31B Rs36.60/Rs91.50.
- Terms https://www.sarvam.ai/terms-of-service **[read]**: s8.2 "We process and store information in India and may transfer it to other countries."; s8.1 Customer = controller, Sarvam = processor (per DPA); s17.5 "Where and to the extent we use Inputs, Outputs or usage data for training our machine-learning models..." conditional, may require consent; retention periods not in ToS. Whether API data is used for training in practice: **not confirmed**; ask for DPA. A separate "Commercial Licensing" page exists for generated audio (not read).
- Indian-language quality: positioned for Indic; no benchmark read here.

### Anthropic / OpenAI / DeepSeek / Qwen
- Anthropic https://platform.claude.com/docs/en/about-claude/pricing **[read]**: no free-credit statement found. Haiku 5.5 $0.10/$0.50 per M (prompts <=100k); Sonnet 5.5 $2/$10. No STT/TTS.
- OpenAI https://developers.openai.com/api/docs/pricing **[read]**: no free API credits stated. gpt-5-nano $0.05/$0.40; gpt-5-mini $0.25/$2.00; gpt-4.1-mini $0.40/$1.60. gpt-4o-mini-transcribe $0.003/min; Whisper $0.006/min; tts-1 $15/M chars; gpt-4o-mini-tts $0.60/M text tokens + $12/M audio tokens.
- DeepSeek https://api-docs.deepseek.com/quick_start/pricing **[read]**: no free credits mentioned; deepseek-flash $0.15 in (miss) / $0.60 out off-peak ($0.3/$1.2 peak); 1M context. Hosted in China: data-residency concern for Indian hiring data (my assessment, not from the page). Qwen/Alibaba trial: **not checked**.

### Self-hosting open weights
- gpt-oss-20b https://huggingface.co/openai/gpt-oss-20b **[read]**: Apache 2.0; "run within 16GB of memory" (MXFP4); 120B needs a single 80GB GPU (H100/MI300X).
- Cloud GPU (India) https://www.e2enetworks.com/pricing **[read]**: on-demand per GPU-hour, ex-tax: L4 $0.57, L40S $1.20, A100-40GB $1.98, A100-80GB $2.10, H100 $2.69, H200 $3.99; CPU C3 (4 vCPU/8GB) $0.049/h. 24/7 = ~730 h: L4 ~$416/mo, L40S ~$876/mo, H100 ~$1,964/mo. US GPU prices: **not checked**.
- Whether gpt-oss-20b fits an L4 (24GB) with KV cache at acceptable throughput: **not verified**. CPU-only LLM serving for this workload: **not verified**, likely too slow for 25 calls/interview with concurrency (assessment).
- Self-hosting only wins when GPU utilisation is high: one L4 at ~$416/mo equals ~20,000 Groq-gpt-oss-20b-LLM-only interviews ($0.005 each) - i.e. not cheaper at our scale.

## 2. Speech-to-text

| Option | Free? | Facts |
|---|---|---|
| Groq Whisper turbo | Free-plan limits as in section 1 (28.8K audio-sec/day = 480 min) | $0.04/hour paid **[read]**. Hindi quality: not documented. |
| Deepgram | $200 one-time credit, no expiry **[read]** https://deepgram.com/pricing | Nova-3 prerecorded $0.0043/min mono, $0.0052/min multilingual; **Hindi support not stated on page** (not found). Aura-2 TTS $0.030/1k chars. |
| AssemblyAI | $50 credit, no card **[read]** https://www.assemblyai.com/pricing | Universal-2 $0.15/h, Universal-3.5 Pro $0.21/h; free streaming 5 new streams/min. Hindi not stated (not found). |
| Google Cloud STT | Page fetch truncated; free tier/prices **not found** (general memory: ~60 min/month, unverified) | - |
| Azure Speech F0 | **5 audio hours/month** real-time STT; **0.5M chars/month** neural TTS **[read]** | paid prices rendered as "$-" (not found) |
| Sarvam STT | Rs100 credit | Rs30/hour **[read]**; Indic-focused; processed in India per ToS s8.2 |
| Cloudflare Whisper | 10K neurons/day shared | $0.0005/min **[read]** |
| OpenAI | none | $0.003/min (4o-mini-transcribe) **[read]** |
| faster-whisper (self-host) | MIT licence | **[read]** README: small model, 13 min audio, i7-12700K 8 threads: int8 1m42s (about 7.6x real time), 1.5GB RAM; fp32 2m37s. large-v2 on RTX 3070Ti fp16 1m03s. So a CPU VPS can transcribe a 15-min answer set in ~2 min on a fast 8-thread CPU with the small model. **Hindi accuracy on small: not found** (small Whisper is known to be weak on Hindi/Hinglish: general knowledge, unverified here). |
| Browser Web Speech API | Free | **[read]** MDN: "By default... Your audio is sent to a web service for recognition processing"; on-device `processLocally` exists with language-pack download (not universally available). Per-browser support/Hindi accuracy: MDN compat table not read. Sends candidate audio to a browser vendor (Google for Chrome): unacceptable for compliance-grade hiring evidence. |

## 3. Text-to-speech
- Gemini TTS: free tier "Yes" on pricing page **[read]** (limits not published). Same free-tier data terms apply. Paid: see section 1.
- Azure neural TTS: 0.5M chars/month free **[read]**; paid price not found.
- Google Cloud TTS: Hindi (hi-IN) voices exist; free allowance amounts and prices **not found** (page truncated).
- Edge TTS (rany2/edge-tts) **[read]** GitHub README: individual project, works "WITHOUT needing Microsoft Edge or Windows or an API key", code GPL-3.0; it uses Microsoft's Edge read-aloud endpoint; no ToS/licence from Microsoft stated on the page. **Unofficial; ToS risk; do not use in production** (assessment).
- Piper https://github.com/OHF-Voice/piper1-gpl **[read]**: local neural TTS, **GPL-3.0**; Hindi voices not confirmed; CPU performance not stated. Coqui: not checked (project is unmaintained, licence limits on XTTS: not verified).
- Sarvam Bulbul v3: Rs3/1k chars **[read]**.
- Cloudflare melotts $0.0002/min; OpenAI tts-1 $15/M chars.
- Browser `speechSynthesis`: free, local, voice quality/Hindi voice availability vary by device (not verified); no data leaves the device in typical use (unverified).

## 4. (a) Free capacity: 15-min interviews per day

Assumptions: per interview 35,000 input + 8,000 output = 43,000 tokens in ~25 calls (avg ~1,400 in / 320 out per call); 15 min = 900 s audio; all answers audio. A free tier that can't cover 25 calls/interview on RPM also noted.

| Free tier | Binding limit | Arithmetic | Interviews/day (LLM) | STT |
|---|---|---|---|---|
| Groq gpt-oss-20b (sample table; Free plan not confirmed) | 200K TPD | 200,000 / 43,000 = 4.65 | **4** | Whisper: 28,800 s / 900 = **32** (hour cap 7,200 s = 8/hour) |
| Groq 120b (separate TPD bucket assumed) | 200K TPD | 4.65 | 4 (so ~8 if split across the two models, assumption) | same |
| Cerebras trial gpt-oss-120b | 1M TPD (but 30-day $5 credit, not for production) | 1,000,000 / 43,000 = 23.3; RPM 5 -> 25 calls needs >=5 min | **23** (trial only) | none |
| Cloudflare gpt-oss-20b | 10,000 neurons/day | in 35,000 x 18,182/1M = 636; out 8,000 x 27,273/1M = 218; total 854; 10,000/854 = 11.7 | **11** (LLM only) | Whisper 900/60 x 46.63 = 700 neurons; LLM+STT = 1,554 -> **6** |
| Cloudflare gpt-oss-120b | same | 35,000 x 31,818/1M = 1,114; 8,000 x 68,182/1M = 545; 1,659; 10,000/1,659 | **6** (LLM only) | with Whisper 2,359 -> 4 |
| OpenRouter :free | 50 req/day (<$10 purchased) | 50 / 25 calls | **2** | none |
| OpenRouter :free | 1,000 req/day (>=$10 purchased); 20 RPM | 1,000 / 25 = 40 | **40** (if a free model with acceptable quality/JSON is up: not verified) | none |
| Gemini free | not published officially | cannot compute (not found). Snippet-only 100-1,500 RPD would be 4-60 | not computed | audio free but not published |
| Azure F0 STT | 5 h/month | 300 min / 15 = 20 per **month** | - | **~0.7/day** |
| Sarvam Rs100 (one-off) | Rs100 | STT Rs30/h x 0.25 = Rs7.50; LLM 105B: 35,000 x 29.28/1M = Rs1.02 + 8,000 x 73.20/1M = Rs0.59 = Rs1.61; total Rs9.11 -> 10.98 | **~11 total, once** | included |
| Deepgram $200 (one-off) | $200 | 15 x $0.0052 = $0.078 -> 2,564 | - | **2,564 total, once** |
| AssemblyAI $50 (one-off) | $50 | 0.25 h x $0.15 = $0.0375 -> 1,333 | - | **1,333 total, once** |

Conclusion: free LLM capacity is about 2-40 interviews/day at best; nothing sustains even a small pilot reliably.

## 5. (b) Verdicts

**(i) Development/testing with synthetic data only:** Groq free (rotating 20b/120b), Gemini free, Cloudflare free, OpenRouter :free (after $10 top-up if wanted), Cerebras trial, Deepgram/AssemblyAI/Sarvam credits, browser Web Speech and speechSynthesis, Edge TTS (dev only), local faster-whisper. No real candidate data.

**(ii) Closed pilot with real candidates:** Not acceptable: **Gemini free tier** (training + human review + "do not submit personal information"), **OpenRouter :free** (free-model provider training/logging unverified), **Web Speech API default mode** (audio to a third party), **Edge TTS** (ToS risk), **DeepSeek** (China-hosted, assessment), **Cerebras trial** ("not intended for production", terms unread), **Mistral free tier** (terms not verified), **NVIDIA/other prototyping credits** (terms not found). Conditionally acceptable only after reading the DPA/ToS and obtaining candidate consent: Groq with ZDR enabled (retention documented; training statement not found), Sarvam (India processing, processor role, training clause conditional: get DPA in writing), Deepgram/AssemblyAI credits (data terms not read; verify no-training), Cloudflare (terms not read). Simplest: spend a few dollars on **paid-tier** keys for the pilot; the pilot then costs about $0.02/interview and removes the free-tier data-use issue. DPDP: you are a data fiduciary or processor; you need notice/consent, processor contracts and breach handling. I did not read DPDP text in this task; get counsel.

**(iii) Paid production:** Groq paid (ZDR on), Gemini paid (not used for product improvement per pricing page; EEA requires paid), Sarvam paid (India processing), OpenAI/Anthropic paid. Not acceptable in production: any free tier, Edge TTS, Web Speech cloud mode as the system of record, GPL TTS (Piper) without licence review for a closed SaaS (running it as a service is generally fine under GPL, but get review).

## 6. (c) Cheapest compliant production stack (documented prices)

Per-interview cost (35k in / 8k out, 15 min audio, TTS excluded unless noted):

| Stack | LLM | STT | Total |
|---|---|---|---|
| A. Groq paid: gpt-oss-20b + whisper-large-v3-turbo | 35,000 x 0.075/1M + 8,000 x 0.30/1M = $0.0026 + $0.0024 = $0.0050 | 0.25 h x $0.04 = $0.010 | **$0.015** |
| A'. Groq gpt-oss-120b + turbo | 0.00525 + 0.0048 = $0.0100 | $0.010 | **$0.020** |
| B. Gemini paid: 2.5 Flash-Lite + 3.5 Transcribe | 0.0035 + 0.0032 = $0.0067 | 15 x $0.003 = $0.045 | **$0.052** |
| C. Sarvam: 105B + STT | Rs1.61 | Rs7.50 | **Rs9.11** |
| D. OpenAI: gpt-5-nano + 4o-mini-transcribe | 0.00175 + 0.0032 = $0.0050 | $0.045 | **$0.050** |
| E. Claude Haiku 5.5 + Groq turbo | 0.0035 + 0.0040 = $0.0075 | $0.010 | **$0.0175** |

Monthly (excluding TTS, taxes, retries):

| Interviews/month | A (Groq 20b) | A' (Groq 120b) | B (Gemini) | C (Sarvam) |
|---|---|---|---|---|
| 100 | $1.50 | $2.00 | $5.20 | Rs911 |
| 1,000 | $15 | $20 | $52 | Rs9,110 |
| 10,000 | $150 | $200 | $520 | Rs91,100 |

TTS add-on: browser speechSynthesis $0; OpenAI tts-1 about 1,050 chars (7 questions x ~150 chars, assumed) x $15/M = $0.016; Sarvam Bulbul Rs3.15; Gemini TTS audio-token count per char not found (not computed). Recommendation: **Stack A or A' with ZDR enabled, plus Sarvam STT as the Hindi/Hinglish path** if Whisper turbo's Hindi accuracy tests poorly on your own audio samples (test it; unverified). Paid Groq at 30 RPM-class limits may need the paid tier's higher limits; paid-tier limits: not found. Self-hosting is not cheaper below ~20,000 interviews/month (one L4 ~$416/month).

## 7. (d) Risks
- Free tiers are volatile: Gemini free tier "Flash-only / limits cut" claims **[snippet only]**, Gemini 3.x Flash price rises 2027-01-01 **[read]**, GitHub Models retired **[read]**, Cerebras trial expiry 30 days **[read]**, Groq limits "per org and may vary" **[read]**.
- Gemini free: terms force EEA users onto paid; training use of inputs.
- Region blocks / availability in India: not found for any provider. DeepSeek China hosting. Groq/Gemini data residency: not found; only Sarvam states India processing **[read]**.
- Rate limits on paid tiers (RPM/TPM at higher tiers) not found for Groq/Gemini; a burst of simultaneous interviews can 429.
- Model churn (model names in these pages are current as read; they will change).
- Whisper-turbo Hindi/Hinglish accuracy, per-request minimum audio billing, and JSON-schema reliability of gpt-oss via Groq are unverified: run an evaluation on your own transcripts.

## 8. Could not verify
- Gemini free-tier numeric limits (official); Gemini JSON-schema and India latency.
- Groq exact Free-plan limits (page shows Developer-plan base table); Groq training statement; Groq data residency; Groq paid-tier rate limits; Groq structured-output support; Groq per-request audio minimums.
- OpenRouter current :free model list, their quality, and per-provider retention/training.
- Cerebras paid prices and data terms; Mistral free-tier limits/training terms (404); NVIDIA free credits (404); Fireworks/SambaNova/Together free credits and rate limits; DeepSeek/Qwen trials; Anthropic/OpenAI free credits (none on pages read, but not an explicit "none" statement).
- Google Cloud STT/TTS free amounts and prices (page truncated); Azure paid prices (placeholders); Deepgram/AssemblyAI Hindi support and data/training terms.
- Hindi/Hinglish accuracy of Whisper (any size), Sarvam, Deepgram, Gemini; Piper/Coqui Hindi voices; Web Speech browser support table; speechSynthesis Hindi voices.
- US cloud GPU prices; gpt-oss-20b on L4 throughput; CPU-only LLM viability.
- Indian DPDP Act/Rules text and cross-border transfer rules (not read).
