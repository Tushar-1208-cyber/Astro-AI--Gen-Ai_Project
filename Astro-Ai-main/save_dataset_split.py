
import matplotlib.pyplot as plt

# Data for Pie Chart
labels = ['Training Set (80%)', 'Validation Set (10%)', 'Test Set (10%)']
sizes = [80, 10, 10]
colors = ['#4f46e5', '#10b981', '#f59e0b']
explode = (0.1, 0, 0)  # explode the Training slice for emphasis

plt.figure(figsize=(8, 8))
plt.pie(sizes, explode=explode, labels=labels, colors=colors, autopct='%1.1f%%',
        shadow=True, startangle=140, textprops={'fontsize': 12, 'fontweight': 'bold'})

plt.title('Dataset Split Strategy (Astro-Ai)', fontsize=16, fontweight='bold')
plt.axis('equal')  # Equal aspect ratio ensures that pie is drawn as a circle.

plt.savefig('dataset_split_chart.png', dpi=300)
print("✅ Dataset split chart saved as dataset_split_chart.png")
