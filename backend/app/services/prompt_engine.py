def build_prompt(action_type: str, language: str, code: str, question_text: str | None):
    base_instruction = """
You are a senior software engineer reviewing code for DSA / competitive programming.

STRICT RULES:
- Return ONLY valid JSON.
- Do NOT include markdown.
- Do NOT include explanations outside JSON.
- Do NOT add text before or after JSON.
- Output must be parseable with json.loads().
- Be deterministic and concise.

Return ONLY in this exact format:

{
  "summary": "",
  "bugs": [],
  "improvements": [],
  "corrected_code": ""
}

Formatting rules:
- summary: 2-5 sentences maximum.
- bugs: array of strings.
- improvements: array of strings.
- corrected_code: full corrected solution only when explicitly requested by the task; otherwise empty string.
- Whenever possible, mention bug locations using line numbers like 'Line 7' or 'Lines 10-12'.
- Prioritize algorithmic feedback, correctness, and edge cases over style comments.
"""

    if action_type == "review":
        task = """
Perform a deep technical review.

Focus on:
- logical correctness
- edge cases
- bug location with line numbers
- better algorithm if current one is suboptimal

In bugs:
- identify exact bug locations
- explain why the current logic fails

In improvements:
- suggest improved algorithm or data structure
- explain the expected complexity improvement if relevant

In corrected_code:
- ALWAYS return an empty string.
"""

    elif action_type == "hint":
        task = """
Act like an interviewer giving progressive hints for DSA optimization.

Primary goal:
- focus on the core algorithmic idea and optimization path
- ignore import statements and basic syntax-level comments
- do not provide final code unless absolutely necessary; corrected_code should stay empty

If question context exists, align hints to that exact problem.
If question context is missing, infer likely intent from code and provide optimization guidance from the existing approach.

Output rules for hints:
- summary: describe the current approach quality in 1-2 lines
- bugs: list key algorithmic gaps only
- improvements: provide exactly 4 hints in order
- each hint must begin with 'Hint 1', 'Hint 2', 'Hint 3', 'Hint 4'
- corrected_code: ALWAYS return an empty string
"""

    elif action_type == "complexity":
        task = """
Analyze complexity only.

In bugs:
- list current inefficiencies or algorithmic bottlenecks.

In improvements:
- state current time complexity
- state current space complexity
- state optimal or better achievable complexity
- suggest the algorithmic direction to reach it

In corrected_code:
- ALWAYS return an empty string.
"""

    elif action_type == "diff":
        task = """
Review code changes carefully.

In bugs:
- identify regressions and risky changed lines with line references.

In improvements:
- suggest safer alternatives or missing tests.

In corrected_code:
- ALWAYS return an empty string.
"""

    elif action_type == "fix":
        task = """
Fix the code.

In bugs:
- identify the failing logic and line references.

In improvements:
- explain the corrected algorithm and why it is better.

In corrected_code:
- provide the corrected complete code in the same language as the input.
- do not wrap it in markdown fences.
"""

    else:
        task = "Analyze the code."

    question_section = f"\nProblem context:\n{question_text}\n" if question_text else ""

    return f"""
{base_instruction}

Important:
Assume this is a competitive programming / DSA interview problem.
Be analytical and precise.

Task:
{task}

Language: {language}

{question_section}

Code:
{code}
"""
