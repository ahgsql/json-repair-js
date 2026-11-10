# json-repair-js

JavaScript kütüphanesi olarak LLM'ler tarafından üretilen veya bozuk olan JSON string'lerini onarır.

## Özellikler

- LLM çıktılarındaki JSON'ları otomatik bulma ve parse etme
- Eksik tırnak işaretlerini düzeltme
- Eksik virgülleri düzeltme
- Unicode karakterleri koruma
- Markdown/text içindeki JSON'ları bulma
- Yorumları atlama; Python `None`/`True`/`False`/tuple desteği
- Kaçışsız ve akıllı tırnakları işleme, kaçış dizilerini çözme
- Bitmemiş girdi için akışa uygun çıktı (`streamStable`)
- TypeScript tipleri dahil

## Kurulum

```bash
npm install json-repair-js
```

## Kullanım

```javascript
const { repairJson, loads } = require('json-repair-js');

// Basit kullanım
const brokenJson = '{ name: John, age: 30 }';
const result = loads(brokenJson);
console.log(result); // { name: "John", age: 30 }

// LLM çıktısından JSON parse etme
const llmOutput = `Anlıyorum işte size uygun bir JSON: \`\`\`json 
{ 
    "title": "Örnek Başlık",
    "items": ["item1" "item2" "item3"]
}`;

const parsed = loads(llmOutput);
console.log(parsed); // { title: "Örnek Başlık", items: ["item1", "item2", "item3"] }

// Detaylı kontrol için repairJson kullanımı
const result2 = repairJson(brokenJson, {
    returnObjects: false,  // true: JavaScript objesi, false: JSON string döner
    skipJsonParse: false, // true: JSON.parse kontrolünü atlar
    logging: false,      // true: onarım loglarını da döner
    ensureAscii: true   // false: Unicode karakterleri korur
});
```

## Özellikler ve Onarımlar

1. Eksik tırnak işaretlerini düzeltme:
```javascript
'{ name: John }' -> '{ "name": "John" }'
```

2. Eksik virgülleri düzeltme:
```javascript
'["a" "b" "c"]' -> '["a", "b", "c"]'
```

3. LLM çıktılarını temizleme:
```javascript
'İşte JSON: ```json { "key": "value" }```' -> '{ "key": "value" }'
```

4. Unicode karakterleri koruma:
```javascript
repairJson('{ test: "Türkçe" }', { ensureAscii: false })
// Çıktı: { "test": "Türkçe" }
```

5. Yorum satırlarını (`//` ve `/* */`) atlama:
```javascript
'{ "a": 1, // not\n "b": 2 }' -> '{ "a": 1, "b": 2 }'
```

6. Python değerleri: `None` `null` olur, `True`/`False` boolean olur, tuple'lar dizi olur:
```javascript
"{'a': None, 'b': True, 'c': (1, 2)}" -> '{ "a": null, "b": true, "c": [1, 2] }'
```

7. Kaçışsız ve akıllı (typographic) tırnaklar:
```javascript
'{"a": "he said "hi" to me"}' -> '{ "a": "he said \\"hi\\" to me" }'
'{“a”: “b”}'                  -> '{ "a": "b" }'
```

8. `\n`, `\t`, `\u00e9` gibi kaçış dizileri, bozuk JSON'da da çözülür.

## Akış (bitmemiş girdi)

Girdi hâlâ üretiliyorsa (ör. token token akan bir LLM yanıtı) `streamStable: true` verin. Girdinin sonunda
kesilmiş ve son hâli henüz belli olmayan her şey (`123`'ün `12`'si, `tru`, değeri henüz gelmemiş bir anahtar)
sonuca eklenmez. Böylece bir belgenin daha uzun bir önekinin sonucu, her zaman daha kısa olanın devamı olur.
Yarım kalmış string'ler olduğu yere kadar döner.

```javascript
loads('{"a": 1, "b": 12', { streamStable: true });   // { a: 1 }
loads('{"a": 1, "b": 123}', { streamStable: true }); // { a: 1, b: 123 }
loads('{"a": 1, "text": "Mer', { streamStable: true }); // { a: 1, text: "Mer" }
```

## TypeScript

Tip tanımları pakete dahildir (`src/index.d.ts`):

```typescript
import { repairJson, loads } from 'json-repair-js';

const user = loads<{ name: string }>('{ name: John }');
const json: string = repairJson('{ name: John }');
const [value, logs] = repairJson('{ name: John }', { logging: true });
```

## Lisans

MIT
