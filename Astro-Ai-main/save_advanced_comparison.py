
import matplotlib.pyplot as plt
import numpy as np

# Categories
categories = ['Response Speed', 'Cost Efficiency', 'Data Privacy', 'Curriculum Accuracy']

# Prompt Engineering (GPT-3.5/4) scores
gpt_scores = [40, 30, 20, 75] # Cloud latency, High cost, Low privacy

# Astro-Ai (Fine-tuned Local) scores
astro_scores = [95, 100, 100, 88] # Local speed, Zero cost, Full privacy

x = np.arange(len(categories))
width = 0.35

plt.figure(figsize=(10, 6))

# Plotting
plt.bar(x - width/2, gpt_scores, width, label='Prompt Engineering (GPT-4/Cloud)', color='#f43f5e')
plt.bar(x + width/2, astro_scores, width, label='Fine-tuned (Astro-Ai/Local)', color='#10b981')

# Styling
plt.ylabel('Efficiency Score (%)', fontsize=12)
plt.title('Why Fine-tuning? GPT-4 Prompting vs Astro-Ai Local SFT', fontsize=14, fontweight='bold')
plt.xticks(x, categories, fontsize=11)
plt.legend()
plt.ylim(0, 120)

# Labels
for i, v in enumerate(gpt_scores):
    plt.text(i - width/2, v + 2, str(v) + '%', ha='center', fontweight='bold')
for i, v in enumerate(astro_scores):
    plt.text(i + width/2, v + 2, str(v) + '%', ha='center', fontweight='bold', color='#059669')

plt.grid(axis='y', linestyle='--', alpha=0.5)
plt.tight_layout()
plt.savefig('prompt_vs_finetune_comparison.png', dpi=300)
print("✅ Advanced comparison chart saved as prompt_vs_finetune_comparison.png")
