# 🌌 Astro AI: Your Personal AI Assistant for Smarter Education

<div align="center">
  <img src="public/image.png" alt="Astro AI Logo" width="180"/>
  <h3>Empowering Teachers, Inspiring Students</h3>

  [![Next.js](https://img.shields.io/badge/Next.js-15.3.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![TinyLlama](https://img.shields.io/badge/TinyLlama-1.1B--Chat-7A297A?style=for-the-badge)](https://huggingface.co/TinyLlama/TinyLlama-1.1B-Chat-v1.0)
  [![GPU Accelerated](https://img.shields.io/badge/GPU-Accelerated-76B900?style=for-the-badge&logo=nvidia)](https://developer.nvidia.com/cuda-zone)
</div>

---

## 🎯 Overview

**Astro-Ai is a privacy-focused educational platform utilizing a custom fine-tuned Large Language Model. Built with Next.js and a Python backend, it ensures cloud-independent, local execution. The system leverages rigorous dataset splits and performance optimization to deliver secure, AI-driven features like automated quizzes and speech recognition.**

Astro AI is designed to streamline teaching workflows and personalize student learning by providing tools ranging from automated grading to intelligent content generation—all functioning entirely securely on local hardware.

---

## 🧠 Model Architecture & Methodology

Astro AI is built around a custom-trained local inference pipeline designed for data privacy and high performance without relying on external cloud APIs.

### 📊 Dataset & Fine-Tuning
Our custom LLM (TinyLlama-1.1B) was fine-tuned specifically for educational contexts.
- **Dataset Split**: Rigorous distribution strategy using **80% Training**, **10% Validation**, and **10% Testing** to ensure high generalization and prevent model overfitting.
- **Performance Gains**: The fine-tuned model demonstrates significantly lower latency and higher context accuracy compared to base foundational models in educational tasks.

### ⚡ Hardware Acceleration
The local FastAPI inference server utilizes robust PyTorch and CUDA optimizations:
- **GPU vs. CPU Execution**: Benchmarks show our GPU-accelerated inference runs up to **5x faster** than CPU execution, allowing for real-time responsiveness in tasks like Quiz Generation and Chat Inference.

---

## ✨ Core Features

### 🤖 Ask Astro (Academic Tutor)
*   **Intelligent Explanations**: Grade-appropriate, detailed answers to academic questions.
*   **Multi-language Support**: Fully localized in English, Hindi, Bengali, Bhojpuri, Tamil, Telugu, and more.
*   **Speech Integration**: Integrated Text-to-Speech (TTS) and Speech Recognition for hands-free learning.

### 📋 Smart Classroom Management
*   **AI Attendance**: Facial recognition student identification for instant attendance tracking.
*   **Grade Tracking**: Visual analytics and performance monitoring for student progress.
*   **Student Roster**: Secure management of student profiles and photo databases.

### 📝 Content & Assessment Suite
*   **Photo-to-Worksheet**: Convert textbook images into interactive digital worksheets.
*   **Quiz Generator**: Automatically create assessments (MCQ, True/False, Short Answer) on any topic.
*   **Lesson Planner**: AI-generated detailed lesson plans matching school curriculum.
*   **Rubric Creator**: Generate professional grading rubrics in seconds.

---

## 🛠️ Tech Stack

*   **Frontend**: Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS, Radix UI.
*   **AI Server**: FastAPI, PyTorch, Transformers, PEFT (LoRA), Cuda/GPU Acceleration.
*   **Local LLM**: TinyLlama-1.1B-Chat-v1.0 (Fine-tuned for educational context).
*   **Database**: MongoDB (User Auth & Metadata), Firebase (Storage & Real-time data).
*   **Internationalization**: Multi-language support via structured JSON locales.

---

## 🚀 Getting Started

### 1. Prerequisites
*   Node.js (v18+)
*   Python (v3.12+)
*   CUDA-compatible GPU (Highly recommended for fast AI inference)

### 2. Frontend Installation
```bash
# Clone the repository
git clone <repository-url>
cd Astro-Ai-main

# Install dependencies
npm install

# Run the development server
npm run dev
```

### 3. Local AI Server Setup
The AI server runs independently to provide fast, private, and local model inference.
```bash
# Install Python dependencies
pip install fastapi uvicorn torch transformers peft pydantic matplotlib python-docx

# Run the AI server
py -3.12 ai_server.py
```
*The server will automatically load the LoRA adapters from the `./my_finetuned_model` directory.*

---

## 📂 Project Structure & Research Scripts

Astro AI includes a comprehensive suite of scripts used for research, reporting, and dataset generation:

```bash
├── src/
│   ├── app/                    # Next.js Pages & UI
│   ├── ai/                     # AI logic & Genkit Server Integrations
│   ├── components/             # Reusable UI Components
├── ai_server.py                # Local FastAPI inference server
├── my_finetuned_model/         # LoRA Adapters for local inference
├── generate_data.py            # Synthetic educational dataset generation
├── generate_multilingual_dataset.py # Multilingual JSON dataset generator
│
# --- 📈 Research & Visualization Scripts ---
├── save_local_arch.py          # Generates Local Architecture Diagrams
├── save_methodology_flow.py    # Generates the Methodology Flowchart
├── save_dataset_split.py       # Visualizes Train/Val/Test data splits
├── save_comparison.py          # Generates Base vs Finetuned comparison graphs
├── save_advanced_comparison.py # Detailed inference performance comparisons
├── save_gpu_vs_cpu.py          # Benchmarks GPU vs CPU execution times
├── save_metrics.py             # Generates evaluation metric summaries
│
# --- 📑 Reporting ---
├── create_docx_report.py       # Compiles a complete academic Word document report
├── generate_report.py          # Generates internal evaluation reports
└── grade_wise_subjects.json    # Core Curriculum database
```

### 📊 Generating the Project Report
You can easily regenerate all charts and compile the final academic report by running:
```bash
# Step 1: Generate all visualization charts
python save_local_arch.py
python save_methodology_flow.py
python save_dataset_split.py
python save_comparison.py
python save_gpu_vs_cpu.py
python save_metrics.py

# Step 2: Compile everything into a DOCX report
python create_docx_report.py
```

---

<div align="center">
  Developed with ❤️ for the future of education, entirely independent of the cloud.
</div>
