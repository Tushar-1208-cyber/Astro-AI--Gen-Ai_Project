
import matplotlib.pyplot as plt

def draw_methodology_flow():
    fig, ax = plt.subplots(figsize=(10, 8))
    
    # Define boxes [x, y, width, height, label, color]
    boxes = [
        [0.25, 0.80, 0.5, 0.1, "Phase 1: Data Synthesis & Collection\n(IndicQA + Synthetic Multilingual Data)", "#3b82f6"],
        [0.25, 0.60, 0.5, 0.1, "Phase 2: Data Preprocessing\n(Instruction Formatting & BPE Tokenization)", "#8b5cf6"],
        [0.25, 0.40, 0.5, 0.1, "Phase 3: PEFT Fine-Tuning\n(QLoRA on TinyLlama-1.1B via NVIDIA GPU)", "#ec4899"],
        [0.25, 0.20, 0.5, 0.1, "Phase 4: RAG Integration\n(Vector Embeddings & ChromaDB Semantic Search)", "#f59e0b"],
        [0.25, 0.00, 0.5, 0.1, "Phase 5: Full-Stack Deployment\n(FastAPI Backend & Next.js Frontend)", "#10b981"]
    ]

    for box in boxes:
        # Draw shadow
        shadow = plt.Rectangle((box[0]+0.01, box[1]-0.01), box[2], box[3], facecolor='black', alpha=0.2, lw=0)
        ax.add_patch(shadow)
        # Draw box
        rect = plt.Rectangle((box[0], box[1]), box[2], box[3], facecolor=box[5], edgecolor='black', alpha=0.9, lw=2)
        ax.add_patch(rect)
        plt.text(box[0] + box[2]/2, box[1] + box[3]/2, box[4], 
                 ha='center', va='center', color='white', fontweight='bold', fontsize=11)

    # Define downward arrows
    # (start_x, start_y, dx, dy)
    arrows = [
        (0.5, 0.80, 0, -0.07),
        (0.5, 0.60, 0, -0.07),
        (0.5, 0.40, 0, -0.07),
        (0.5, 0.20, 0, -0.07)
    ]

    for arrow in arrows:
        ax.annotate('', xy=(arrow[0] + arrow[2], arrow[1] + arrow[3]), xytext=(arrow[0], arrow[1]),
                    arrowprops=dict(arrowstyle='->', lw=2.5, color='#334155'))

    plt.title("Astro-Ai: Project Methodology & Development Flow", fontsize=16, fontweight='bold', pad=20, color='#1e293b')
    plt.axis('off')
    
    # Adjust limits so everything fits perfectly
    plt.xlim(0, 1)
    plt.ylim(-0.05, 1.0)
    
    plt.tight_layout()
    plt.savefig('methodology_flow_diag.png', dpi=300, bbox_inches='tight')
    print("✅ Methodology Flow diagram saved as methodology_flow_diag.png")

if __name__ == "__main__":
    draw_methodology_flow()
