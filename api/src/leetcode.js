// Normalises LeetCode's /submissions/detail/{id}/check/ payloads.
// RUN ("interpret_solution") and SUBMIT results share the endpoint but differ:
// a run with status "Accepted" only means it executed; correctness is `correct_answer`.

const STATUS = {
  10: "Accepted", 11: "Wrong Answer", 12: "Memory Limit Exceeded", 13: "Output Limit Exceeded",
  14: "Time Limit Exceeded", 15: "Runtime Error", 16: "Internal Error", 20: "Compile Error", 30: "Timeout",
};

export const VERDICTS = ["Accepted", "Wrong Answer", "Time Limit Exceeded", "Memory Limit Exceeded", "Runtime Error", "Compile Error", "Output Limit Exceeded"];

const firstMismatch = (compare) => (typeof compare === "string" ? compare.indexOf("0") : -1);
const asText = (v) => (Array.isArray(v) ? v.join("\n") : v == null ? "" : String(v));

export function normalizeResult(kind, raw = {}, { dataInput = "" } = {}) {
  const statusMsg = raw.status_msg ?? STATUS[raw.status_code] ?? "Unknown";
  let verdict = statusMsg;
  let expectedOutput = raw.expected_output ?? "";
  let codeOutput = raw.code_output ?? "";
  let lastTestcase = raw.last_testcase ?? "";

  if (kind === "run") {
    if (raw.run_success && raw.status_code === 10) {
      verdict = raw.correct_answer === false ? "Wrong Answer" : "Accepted";
    }
    const idx = firstMismatch(raw.compare_result);
    const exp = raw.expected_code_answer ?? [];
    const got = raw.code_answer ?? [];
    if (idx >= 0) {
      expectedOutput = asText(exp[idx]);
      codeOutput = asText(got[idx]);
      lastTestcase = `case #${idx + 1} of the custom/sample input`;
    } else {
      expectedOutput = asText(exp);
      codeOutput = asText(got);
    }
    if (!lastTestcase && dataInput) lastTestcase = dataInput;
  }

  return {
    verdict,
    statusCode: raw.status_code ?? null,
    totalCorrect: raw.total_correct ?? null,
    totalTestcases: raw.total_testcases ?? null,
    runtime: raw.status_runtime ?? raw.display_runtime ?? null,
    memory: raw.status_memory ?? raw.memory ?? null,
    runtimePercentile: typeof raw.runtime_percentile === "number" ? raw.runtime_percentile : null,
    lastTestcase: String(lastTestcase ?? "").slice(0, 2000),
    expectedOutput: String(expectedOutput ?? "").slice(0, 1000),
    codeOutput: String(codeOutput ?? "").slice(0, 1000),
    compileError: raw.full_compile_error || raw.compile_error || null,
    runtimeError: raw.full_runtime_error || raw.runtime_error || null,
    stdout: asText(raw.std_output_list ?? raw.std_output ?? "").slice(0, 1000),
  };
}
