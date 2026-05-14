
import matplotlib.pyplot as plt

# Metrics data
metrics = ['Overall Accuracy', 'ROUGE-L', 'BLEU Score', 'Perplexity']
values = [85, 48, 38, 12] # Accuracy is %, others are scores

plt.figure(figsize=(10, 5))
colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444']

# Plotting
bars = plt.barh(metrics, values, color=colors)
plt.title('Astro-Ai: Evaluation Metrics (Fine-tuned TinyLlama)', fontsize=14, fontweight='bold')
plt.xlabel('Score / Percentage', fontsize=12)
plt.xlim(0, 100)

# Adding labels
for i, v in enumerate(values):
    label = f"{v}%" if i == 0 else str(v/100 if i < 3 else v)
    plt.text(v + 1, i, label, va='center', fontweight='bold', fontsize=12)

plt.grid(axis='x', linestyle='--', alpha=0.7)
plt.tight_layout()
plt.savefig('evaluation_metrics_summary.png', dpi=300)
print("✅ Metrics card saved as evaluation_metrics_summary.png")
