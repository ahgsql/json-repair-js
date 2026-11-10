const { loads, repairJson } = require('../src');

describe('Yorum satırları', () => {
    test('// satır yorumları atlanmalı', () => {
        const input = `{
            "a": 1, // ilk alan
            "b": 2 // son alan
        }`;
        expect(loads(input)).toEqual({ a: 1, b: 2 });
    });

    test('/* blok */ yorumları atlanmalı', () => {
        expect(loads('{"a": /* sayı */ 1, /* anahtar */ "b": 2}')).toEqual({ a: 1, b: 2 });
        expect(loads('/* başlık */ {"a": [1, /* x */ 2]}')).toEqual({ a: [1, 2] });
    });

    test('Kapanmamış blok yorumu girdinin sonuna kadar atlanmalı', () => {
        expect(loads('{"a": 1, /* bitmedi')).toEqual({ a: 1 });
    });

    test('Dizilerde yorumlar atlanmalı', () => {
        expect(loads('[1, // bir\n 2, // iki\n 3]')).toEqual([1, 2, 3]);
    });

    test('String içindeki // ve /* yorum sayılmamalı', () => {
        const input = '{"url": "https://example.com/a", "note": "/* not a comment */", b: 1}';
        expect(loads(input)).toEqual({ url: "https://example.com/a", note: "/* not a comment */", b: 1 });
    });

    test('Sondaki virgül ve boşluk diziye boş eleman eklememeli', () => {
        expect(loads('[1, 2, ')).toEqual([1, 2]);
        expect(loads('[1, 2, // bitti')).toEqual([1, 2]);
    });

    test('Yanlış kapanış parantezi diziyi kapatmalı', () => {
        expect(loads('{"a": [1, 2}, "b": 3}')).toEqual({ a: [1, 2], b: 3 });
    });
});

describe('Python sabitleri', () => {
    test('None null olmalı (büyük/küçük harf fark etmez)', () => {
        expect(loads('{"a": None, "b": none, "c": NONE}')).toEqual({ a: null, b: null, c: null });
        expect(loads('[None, 1]')).toEqual([null, 1]);
    });

    test('True ve False boolean olmalı', () => {
        expect(loads('{"a": True, "b": False}')).toEqual({ a: true, b: false });
    });

    test('Tırnaklı "None" string kalmalı', () => {
        expect(loads('{"a": "None"}')).toEqual({ a: "None" });
    });

    test('Tuple dizi olmalı', () => {
        expect(loads('{"a": (1, 2, 3)}')).toEqual({ a: [1, 2, 3] });
        expect(loads('{"a": ("x", "y"), "b": (a, b)}')).toEqual({ a: ["x", "y"], b: ["a", "b"] });
        expect(loads('{"a": ()}')).toEqual({ a: [] });
    });

    test('Python dict çıktısı onarılmalı', () => {
        const input = "{'name': 'Ali', 'active': True, 'manager': None, 'tags': ('a', 'b')}";
        expect(loads(input)).toEqual({ name: 'Ali', active: true, manager: null, tags: ['a', 'b'] });
        expect(JSON.parse(repairJson(input))).toEqual({ name: 'Ali', active: true, manager: null, tags: ['a', 'b'] });
    });
});
