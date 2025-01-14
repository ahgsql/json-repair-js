# json-repair-js

JavaScript kütüphanesi olarak LLM'ler tarafından üretilen veya bozuk olan JSON string'lerini onarır.

## Özellikler

- LLM çıktılarındaki JSON'ları otomatik bulma ve parse etme
- Eksik tırnak işaretlerini düzeltme
- Eksik virgülleri düzeltme
- Unicode karakterleri koruma
- Markdown/text içindeki JSON'ları bulma

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

## Lisans

MIT
