// 의존성 없는 초경량 테스트 하네스
let failed = 0;
let passed = 0;

export function section(title) {
  console.log(`\n▸ ${title}`);
}

export function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ""}`);
  }
}

export function summary() {
  console.log(
    failed === 0
      ? `\n✅ ${passed}건 전체 통과`
      : `\n❌ ${failed}건 실패 / ${passed + failed}건`,
  );
  if (failed > 0) process.exitCode = 1;
}
