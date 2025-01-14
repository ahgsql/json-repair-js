const { loads } = require('../src');

describe('JSON Repair Tests', () => {
    test('LLM tarafından üretilen bozuk JSON düzeltilmeli', () => {
        const input = `Anlıyorum işte size uygun bir JSON: \`\`\`json { "title": "Türk Ceza Hukukunda Yağma Suçunun Kapsamı ve Hukuki Boyutları", "seoKeywords": [ "yağma suçu", "hırsızlık", "tehdit", "ceza hukuku", "TCK",6 ], }`;

        const result = loads(input);
        
        expect(result).toEqual({
            title: "Türk Ceza Hukukunda Yağma Suçunun Kapsamı ve Hukuki Boyutları",
            seoKeywords: ["yağma suçu", "hırsızlık", "tehdit", "ceza hukuku", "TCK", 6]
        });
    });

    test('Eksik tırnak işaretleri düzeltilmeli', () => {
        const input = '{ name: John, age: 30 }';
        const result = loads(input);
        expect(result).toEqual({
            name: "John",
            age: 30
        });
    });

    test('Eksik virgüller düzeltilmeli', () => {
        const input = '{ "name": "John" "age": 30 }';
        const result = loads(input);
        expect(result).toEqual({
            name: "John",
            age: 30
        });
    });

  
});
