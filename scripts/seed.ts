import { withStore } from "../src/lib/store";
console.log(withStore((store) => store.seed()) + " örnek eklendi. Mevcut yorumlar ve kararlar korundu.");
