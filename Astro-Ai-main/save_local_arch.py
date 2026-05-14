
import matplotlib.pyplot as plt

def draw_architecture():
    fig, ax = plt.subplots(figsize=(12, 7))
    
    # Define boxes [x, y, width, height, label, color]
    boxes = [
        [0.4, 0.85, 0.2, 0.1, "USER INTERFACE\n(Next.js / Tailwind)", "#4f46e5"],
        [0.4, 0.65, 0.2, 0.1, "BACKEND API\n(FastAPI / Python)", "#10b981"],
        [0.1, 0.4, 0.2, 0.1, "VECTOR STORE\n(ChromaDB)", "#f59e0b"],
        [0.7, 0.4, 0.2, 0.1, "USER DATA\n(MongoDB)", "#ef4444"],
        [0.4, 0.15, 0.2, 0.15, "LOCAL AI ENGINE\n(TinyLlama-1.1B)\n[NVIDIA CUDA GPU]", "#7c3aed"]
    ]

    for box in boxes:
        rect = plt.Rectangle((box[0], box[1]), box[2], box[3], facecolor=box[5], edgecolor='black', alpha=0.8, lw=2)
        ax.add_patch(rect)
        plt.text(box[0] + box[2]/2, box[1] + box[3]/2, box[4], 
                 ha='center', va='center', color='white', fontweight='bold', fontsize=10)

    # Define arrows (start_x, start_y, dx, dy)
    arrows = [
        (0.5, 0.85, 0, -0.1),  # UI to API
        (0.5, 0.75, 0, 0.1),   # API to UI
        (0.4, 0.65, -0.15, -0.15), # API to Chroma
        (0.2, 0.5, 0.15, 0.15),    # Chroma to API (Context)
        (0.6, 0.65, 0.15, -0.15),  # API to MongoDB
        (0.5, 0.65, 0, -0.35),     # API to Local AI
        (0.5, 0.3, 0, 0.35)        # Local AI to API (Response)
    ]

    for arrow in arrows:
        ax.annotate('', xy=(arrow[0] + arrow[2], arrow[1] + arrow[3]), xytext=(arrow[0], arrow[1]),
                    arrowprops=dict(arrowstyle='->', lw=1.5, color='black'))

    # Labels for flow
    plt.text(0.52, 0.78, "User Request", fontsize=9)
    plt.text(0.25, 0.55, "RAG Retrieval", fontsize=9, rotation=35)
    plt.text(0.52, 0.45, "Prompt + Context", fontsize=9)
    plt.text(0.52, 0.35, "AI Generation", fontsize=9)

    plt.title("Astro-Ai: Local-First System Architecture", fontsize=16, fontweight='bold', pad=20)
    plt.axis('off')
    plt.tight_layout()
    plt.savefig('local_architecture_diag.png', dpi=300, bbox_inches='tight')
    print("✅ Local Architecture diagram saved as local_architecture_diag.png")

if __name__ == "__main__":
    draw_architecture()
