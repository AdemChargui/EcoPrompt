https://github.com/user-attachments/assets/d9c0e173-884f-4c2d-a89e-0efdca6af15a

# EcoPrompt — Smart AI Model Selector for Claude & ChatGPT

**Automatically route your prompts to the optimal AI model based on complexity. Save costs, reduce energy consumption, and get faster responses — all without thinking about which model to use.**

<p align="center">
  <b>⚡ Smart Routing · 🌱 Eco-Friendly · 💰 Cost-Saving</b>
</p>

---

## 🌿 What It Does

EcoPrompt is a Chrome extension that analyzes your prompt's complexity using **NVIDIA's prompt-task-and-complexity-classifier** running locally, then automatically selects and switches to the most appropriate AI model. A simple "hello" goes to Haiku, a complex system design goes to Sonnet 4.6.

| Platform | 🟢 Low Complexity | 🟡 Medium Complexity | 🔴 High Complexity |
|----------|-------------------|----------------------|---------------------|
| **Claude.ai** | Claude Haiku 4.5 | Claude Sonnet 4.5 | Claude Sonnet 4.6 |
| **ChatGPT** | GPT-4o Mini | GPT-4o | o1 / GPT-4.5 |
| **Gemini** | Gemini Flash | Gemini Pro | Gemini Ultra |
| **Perplexity** | Standard | Pro | Pro Advanced |

---

## ✨ Features

- 🔍 **Real-time Complexity Analysis** — NVIDIA's DeBERTa-v3 classifier evaluates your prompt as you type
- 🤖 **Automatic Model Switching** — Seamlessly switches Claude's model selector before you hit send
- 📊 **Live On-Screen Badge** — Shows predicted model tier, complexity score, and task type
- 💰 **Cost Estimation** — See estimated API costs before submitting
- 🌱 **Energy Tracking** — Monitor watt-hours consumed and CO2 emissions saved
- 🎯 **Manual Override** — Force Low/Mid/High tier when you want full control
- 🔄 **Smart Fallback Chains** — If primary model is unavailable, automatically tries alternatives
- 📦 **100% Local Classification** — Your prompts never leave your machine for analysis

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+ with pip
- Chrome / Edge / Brave browser
- ~2GB free RAM for the classifier model

### 1. Clone & Install
` + "``" + `bash
git clone https://github.com/YOUR_USERNAME/ecoprompt.git
cd ecoprompt
pip install -r requirements.txt
` + "``" + `

### 2. Start the Classifier Server
` + "``" + `bash
python nvidia_classifier_server.py
` + "``" + `

Keep this terminal open! You should see:
` + "``" + `
[EcoPrompt] Loading nvidia/prompt-task-and-complexity-classifier ...
[EcoPrompt] Model ready ✅
INFO:     Uvicorn running on http://127.0.0.1:8000
` + "``" + `

### 3. Load the Extension
1. Go to ` + "`" + `chrome://extensions/` + "`" + `
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the ` + "`" + `ecoprompt` + "`" + ` folder

### 4. Start Using
Go to **claude.ai** or **chatgpt.com** and start typing — the badge appears automatically!

---

## 🏗️ How It Works

1. **You type a prompt** on Claude.ai or ChatGPT
2. **EcoPrompt sends it** to the local NVIDIA classifier (port 8000)
3. **Classifier analyzes** 6 dimensions: creativity, reasoning, constraints, domain knowledge, contextual knowledge, and few-shots
4. **Returns complexity score** (0.0–1.0) and task type (code, creative, QA, etc.)
5. **EcoPrompt selects** optimal model tier (Low/Medium/High)
6. **Claude's model selector** is automatically switched before submission

---

## 🎮 Manual Override

Click the badge dropdown to force a specific tier:

| Option | Models |
|--------|--------|
| 🟢 **Small** | Haiku · GPT-4o Mini · Flash |
| 🟡 **Mid** | Sonnet · GPT-4o · Pro |
| 🔴 **Large** | Opus · o1 · GPT-4.5 |
| ✨ **Auto** | Let EcoPrompt decide (default) |

---

## 📁 Project Structure

` + "``" + `
ecoprompt/
├── manifest.json                 # Extension configuration
├── background.js                 # Service worker (routing logic)
├── content.js                    # Webpage injection (badge + Claude switcher)
├── modelSelector.js              # Model selection decision matrix
├── energy.js                     # Energy/CO2 calculations
├── apiKeys.js                    # API key management
├── popup.html/css/js             # Extension popup
├── content.css                   # Badge styling
├── nvidia_classifier_server.py   # Python FastAPI server
├── requirements.txt              # Python dependencies
└── icons/                        # Extension icons
` + "``" + `

---

## 📝 License

Made By Adam Chargui & Othman Jedidi & Med Islem Ben Rhouma 

---

## 🙏 Acknowledgments

- **NVIDIA** for the [prompt-task-and-complexity-classifier](https://huggingface.co/nvidia/prompt-task-and-complexity-classifier)
- **Anthropic** & **OpenAI** for their AI platforms
- **FastAPI** for the Python server framework

---

**Made with ⚡ for smarter, greener AI**
