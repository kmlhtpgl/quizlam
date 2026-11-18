import { ensureSeeded, getQuestionBank } from "./repository";
import { questionCountByCategory } from "./questionSeed";

ensureSeeded();
const bank = getQuestionBank();
console.log(`Seeded ${bank.length} questions.`);
for (const item of questionCountByCategory()) {
  console.log(`  ${item.category}: ${item.count}`);
}
