# Model Limits & Usage History

This document tracks the evolution of Gemini model availability and quotas over time.

## Snapshot: 2026-04-26

### Core Models & Quotas
| Model | Category | RPM (Used/Limit) | TPM (Used/Limit) | RPD (Used/Limit) |
| :--- | :--- | :--- | :--- | :--- |
| **Gemini 3 Flash** | Text-out | 1 / 5 | 2.44K / 250K | 1 / 20 |
| **Gemma 4 31B** | Other | 2 / 15 | 10.89K / Unlimited | 7 / 1.5K |
| **Gemma 3 27B** | Other | 2 / 30 | 10.89K / 15K | 7 / 14.4K |
| **Gemini 3.1 Flash Lite** | Text-out | 0 / 15 | 0 / 250K | 0 / 500 |
| **Gemini 3.1 Pro** | Text-out | 0 / 0 | 0 / 0 | 0 / 0 |

### Multi-modal & Specialty
| Model | Category | RPM | TPM | RPD |
| :--- | :--- | :--- | :--- | :--- |
| **Imagen 4 Generate** | Multi-modal | - | - | 0 / 25 |
| **Veo 3 Generate** | Multi-modal | 0 / 0 | - | 0 / 0 |
| **Gemini 3.1 Flash TTS** | Multi-modal | 0 / 3 | 0 / 10K | 0 / 10 |
| **Gemini Robotics ER 1.6** | Other | 0 / 5 | 0 / 250K | 0 / 20 |

### Grounding & Tools Quotas
| Tool | Model Scope | Quota (Used/Limit) |
| :--- | :--- | :--- |
| **Search Grounding** | Gemini 2.5 / Default | 0 / 1.5K |
| **Map Grounding** | Gemini 2.5 / 3.1 / Robotics | 0 / 500 |

---
*Next snapshot scheduled for comparison on major model releases.*
# Model ID Correlation Table

| Display Name | Technical ID (API Name) | Input Token Limit |
| :--- | :--- | :--- |
| Gemini 3 Flash | `gemini-3-flash-preview` | 1048576 |
| Gemma 4 31B | `gemma-4-31b-it` | 262144 |
| Gemma 3 27B | `gemma-3-27b-it` | 131072 |
| Gemini 2.5 Flash | `gemini-2.5-flash` | 1048576 |
| Gemini 2.5 Pro | `gemini-2.5-pro` | 1048576 |
| Gemini 2 Flash | `NOT_FOUND` | N/A |
| Gemini 2 Flash Lite | `NOT_FOUND` | N/A |
| Gemini 2.5 Flash TTS | `gemini-2.5-flash` | 1048576 |
| Gemini 2.5 Pro TTS | `gemini-2.5-pro` | 1048576 |
| Gemma 3 1B | `gemma-3-1b-it` | 32768 |
| Gemma 3 4B | `gemma-3-4b-it` | 32768 |
| Gemma 3 12B | `gemma-3-12b-it` | 32768 |
| Imagen 4 Generate | `imagen-4.0-generate-001` | 480 |
| Imagen 4 Ultra Generate | `NOT_FOUND` | N/A |
| Imagen 4 Fast Generate | `NOT_FOUND` | N/A |
| Gemma 3 2B | `NOT_FOUND` | N/A |
| Gemma 4 26B | `gemma-4-26b-a4b-it` | 262144 |
| Gemini Embedding 1 | `NOT_FOUND` | N/A |
| Gemini 3.1 Flash Lite | `gemini-3.1-flash-lite-preview` | 1048576 |
| Gemini 3.1 Pro | `gemini-3.1-pro-preview` | 1048576 |
| Gemini 2.5 Flash Lite | `gemini-2.5-flash` | 1048576 |
| Nano Banana (Gemini 2.5 Flash Preview Image) | `gemini-2.5-flash` | 1048576 |
| Nano Banana Pro (Gemini 3 Pro Image) | `nano-banana-pro-preview` | 131072 |
| Nano Banana 2 (Gemini 3.1 Flash Image) | `NOT_FOUND` | N/A |
| Lyria 3 Clip | `lyria-3-clip-preview` | 1048576 |
| Lyria 3 Pro | `lyria-3-pro-preview` | 1048576 |
| Veo 3 Generate | `veo-3.0-generate-001` | 480 |
| Veo 3 Fast Generate | `NOT_FOUND` | N/A |
| Veo 3 Lite Generate | `NOT_FOUND` | N/A |
| Gemini 3.1 Flash TTS | `gemini-3.1-flash-tts-preview` | 8192 |
| Gemini Robotics ER 1.5 Preview | `gemini-robotics-er-1.5-preview` | 1048576 |
| Gemini Robotics ER 1.6 Preview | `gemini-robotics-er-1.6-preview` | 131072 |
| Computer Use Preview | `gemini-2.5-computer-use-preview-10-2025` | 131072 |
| Gemini Embedding 2 | `gemini-embedding-2-preview` | 8192 |
| Deep Research Pro Preview | `deep-research-pro-preview-12-2025` | 131072 |
| Gemini 2.5 Flash Native Audio Dialog | `gemini-2.5-flash` | 1048576 |
| Gemini 3 Flash Live | `NOT_FOUND` | N/A |
