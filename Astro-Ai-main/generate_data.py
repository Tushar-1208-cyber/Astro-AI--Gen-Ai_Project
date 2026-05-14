import json
import random
import os

def generate():
    # Load curriculum data
    curriculum_path = 'grade_wise_subjects_pdf.json'
    topics = []
    
    if os.path.exists(curriculum_path):
        with open(curriculum_path, 'r', encoding='utf-8') as f:
            curriculum = json.load(f)
        for grade_data in curriculum.get('grades', []):
            grade = grade_data.get('grade', 'unknown')
            for subject_data in grade_data.get('subjects', []):
                subject = subject_data.get('subject_name', 'General')
                for link in subject_data.get('pdf_links', []):
                    topic = link.get('title', 'General Topic')
                    topics.append({'grade': grade, 'subject': subject, 'topic': topic})
    
    # Add generic topics to ensure diversity
    generic_topics = [
        "Photosynthesis", "Pythagorean Theorem", "Industrial Revolution", "Cell Division",
        "Shakespearean Sonnets", "Quantum Mechanics", "Organic Chemistry", "World War II",
        "Calculus Basics", "Genetic Engineering", "Ancient Civilizations", "Machine Learning",
        "The Water Cycle", "Algebraic Equations", "The solar system", "Human Anatomy",
        "Sustainable Energy", "Artificial Intelligence", "World Geography", "Music Theory"
    ]

    # Templates for different project features
    templates = [
        # Ask Astro (Academic)
        "Explain {topic} in {subject} for a Grade {grade} student.",
        "I need help understanding {topic} from my Grade {grade} {subject} class.",
        "What are the key concepts of {topic} in Grade {grade} {subject}?",
        "Can you provide a simple summary of {topic} for Grade {grade}?",
        "How does {topic} relate to the rest of the {subject} curriculum in Grade {grade}?",
        "Tell me about {topic} as if I am in Grade {grade}.",
        
        # Quiz Generator
        "Generate a 5-question multiple choice quiz about {topic} for Grade {grade}.",
        "Create a challenging assessment on {topic} for my {subject} students in Grade {grade}.",
        "I want a quiz that covers the basics of {topic} in {subject}.",
        "Prepare a set of practice questions for {topic} (Grade {grade}).",
        "Create a short test for Grade {grade} students on {topic}.",
        
        # Lesson Planner
        "Design a 45-minute lesson plan for {topic} in Grade {grade} {subject}.",
        "Create a lesson outline for {topic} including objectives and activities for Grade {grade}.",
        "Help me plan a creative lesson on {topic} for my {subject} class.",
        "I need a lesson plan template for {topic} for my Grade {grade} students.",
        
        # Mentoring
        "Provide mentoring advice for a Grade {grade} student who is struggling with {topic}.",
        "How can I better explain {topic} to a student who finds {subject} difficult?",
        "Give me some tips to motivate a student learning {topic} in Grade {grade}.",
        "What are common misconceptions Grade {grade} students have about {topic}?",
        
        # Writing Assistant
        "Write a short essay outline about {topic} for a Grade {grade} {subject} assignment.",
        "Help me draft a paragraph explaining {topic} in {subject}.",
        "Suggest some hooks for an essay on {topic} for a Grade {grade} student.",
        "Brainstorm 3 main points for an essay about {topic} in {subject}.",
        
        # Discussion Generator
        "Suggest 3 discussion prompts for a Grade {grade} classroom about {topic}.",
        "How can I start a debate on {topic} in my {subject} class?",
        "Give me some open-ended questions about {topic} for Grade {grade} students.",
        
        # Content Adaptation
        "Rewrite this explanation of {topic} for a Grade {grade} student so it's easier to understand.",
        "Simplify the complex parts of {topic} in {subject} for Grade {grade}.",
        "Adapt the following content about {topic} for a Grade {grade} audience: [Content placeholder]"
    ]

    # Response "Simulator" logic
    def generate_response(template, topic, subject, grade):
        if "quiz" in template.lower() or "test" in template.lower():
            return f"### {topic} Quiz (Grade {grade})\n\n1. What is the primary function of {topic}?\n2. True or False: {topic} is only found in {subject}.\n3. Which of the following is an example of {topic}?\n4. How does {topic} impact {subject}?\n5. Describe one key feature of {topic} in your own words."
        if "lesson plan" in template.lower():
            return f"### Lesson Plan: {topic}\n**Grade**: {grade}\n**Subject**: {subject}\n**Duration**: 45 Minutes\n\n**Objectives**:\n- Students will define {topic}.\n- Students will understand the role of {topic} in {subject}.\n\n**Activities**:\n1. **Opener (5m)**: Discussion on what students know about {topic}.\n2. **Direct Instruction (15m)**: Explanation of key {topic} concepts.\n3. **Guided Practice (15m)**: Group activity exploring {topic}.\n4. **Closing (10m)**: Summary and exit ticket."
        if "mentoring" in template.lower() or "struggling" in template.lower():
            return f"Mentoring Tip: When a Grade {grade} student struggles with {topic}, try using visual aids or real-world analogies. For {subject}, relate {topic} to things they see every day. Encourage them by highlighting that {topic} is a foundational concept."
        if "discussion" in template.lower() or "debate" in template.lower():
            return f"Here are 3 discussion prompts for Grade {grade} {subject}:\n1. Why is {topic} important for our understanding of the world?\n2. What would happen if {topic} didn't exist?\n3. How does {topic} affect your daily life?"
        if "essay" in template.lower() or "outline" in template.lower():
            return f"Essay Outline for {topic} (Grade {grade}):\nI. Introduction: Definition of {topic} and thesis statement.\nII. Main Point 1: The history and development of {topic}.\nIII. Main Point 2: Modern applications of {topic} in {subject}.\nIV. Conclusion: Summary of why {topic} matters."
            
        return f"In the Grade {grade} {subject} curriculum, {topic} is a key area of study. It refers to the process where [Concept] interacts with [Concept]. For example, in {subject}, {topic} helps us understand [Application]. To master {topic}, students should focus on [Key Skill] and [Key Concept]."

    # Main generation loop
    output_file = 'synthetic_data_100k.jsonl'
    target_count = 100000

    print(f"🚀 Generating {target_count} lines of synthetic educational data...")

    with open(output_file, 'w', encoding='utf-8') as f:
        for i in range(target_count):
            # Pick random data points
            if i % 5 == 0 and topics:
                data_point = random.choice(topics)
                grade = data_point['grade']
                subject = data_point['subject']
                topic = data_point['topic']
            else:
                grade = random.choice([str(g) for g in range(1, 13)])
                subject = random.choice(["Science", "Math", "History", "English", "Geography", "Social Studies", "Physics", "Chemistry", "Biology"])
                topic = random.choice(generic_topics)
                
            template = random.choice(templates)
            instruction = template.format(topic=topic, subject=subject, grade=grade)
            response = generate_response(template, topic, subject, grade)
            
            entry = {
                "instruction": f"Instruction: {instruction}",
                "response": f"Response: {response}"
            }
            f.write(json.dumps(entry) + '\n')
            
            if (i + 1) % 10000 == 0:
                print(f"✅ Generated {i + 1} lines...")

    print(f"\n✨ Done! 100,000 lines saved to {output_file}")

if __name__ == "__main__":
    generate()
