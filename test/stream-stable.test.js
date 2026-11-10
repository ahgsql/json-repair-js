const { loads, repairJson } = require('../src');

const stable = { streamStable: true, skipJsonParse: true };

describe('streamStable: kesilmiş girdi', () => {
    test('Sonu kesilmiş sayı, true/false/null ve anahtarlar eklenmemeli', () => {
        expect(loads('{"a": 1, "b": 12', stable)).toEqual({ a: 1 });
        expect(loads('{"a": 1, "b": 1.', stable)).toEqual({ a: 1 });
        expect(loads('{"a": 1, "b": 1e', stable)).toEqual({ a: 1 });
        expect(loads('{"a": 1, "b": -', stable)).toEqual({ a: 1 });
        expect(loads('{"a": 1, "b": tru', stable)).toEqual({ a: 1 });
        expect(loads('{"a": 1, "b": true', stable)).toEqual({ a: 1 });
        expect(loads('{"a": 1, "b": nul', stable)).toEqual({ a: 1 });
        expect(loads('{"a": 1, "b', stable)).toEqual({ a: 1 });
        expect(loads('{"a": 1, "b"', stable)).toEqual({ a: 1 });
        expect(loads('{"a": 1, "b":', stable)).toEqual({ a: 1 });
        expect(loads('{"a": 1, "b": ', stable)).toEqual({ a: 1 });
        expect(loads('{"a": 1, ', stable)).toEqual({ a: 1 });
        expect(loads('{"a": [1, 2, 3', stable)).toEqual({ a: [1, 2] });
        expect(loads('{"a": [1, 2, tr', stable)).toEqual({ a: [1, 2] });
        expect(loads('{"a": [1, 2, /', stable)).toEqual({ a: [1, 2] });
    });

    test('Değer bir ayraçla bittiyse tamamdır', () => {
        expect(loads('{"a": 1, "b": 12,', stable)).toEqual({ a: 1, b: 12 });
        expect(loads('{"a": 1, "b": true ', stable)).toEqual({ a: 1, b: true });
        expect(loads('{"a": [1, 2, 3]', stable)).toEqual({ a: [1, 2, 3] });
        expect(loads('{"a": 1, "b": 12}', stable)).toEqual({ a: 1, b: 12 });
    });

    test('Kesilmiş string olduğu yere kadar döner ve sondaki boşluğu korur', () => {
        expect(loads('{"a": "hel', stable)).toEqual({ a: 'hel' });
        expect(loads('{"a": "hello ', stable)).toEqual({ a: 'hello ' });
        expect(loads('["x", "y', stable)).toEqual(['x', 'y']);
        expect(loads('{"a": "x\\', stable)).toEqual({ a: 'x' });
        expect(loads('{"a": "x\\u00e', stable)).toEqual({ a: 'x' });
    });

    test('Seçenek kapalıyken eski davranış sürer', () => {
        expect(loads('{"a": 1, "b": 12', { skipJsonParse: true })).toEqual({ a: 1, b: 12 });
        expect(loads('{"a": 1, "b": tru', { skipJsonParse: true })).toEqual({ a: 1, b: 'tru' });
    });

    test('Tamamlanmış geçerli JSON aynen döner', () => {
        expect(loads('{"a": 1, "b": [true, null]}', { streamStable: true })).toEqual({ a: 1, b: [true, null] });
        expect(JSON.parse(repairJson('{"a": 1, "b": tru', { streamStable: true }))).toEqual({ a: 1 });
    });
});

describe('streamStable: her önek bir öncekinin devamı olmalı', () => {
    // `partial`, `full`'un bir önekini temsil ediyor mu?
    function isPrefix(partial, full) {
        if (typeof partial === 'string') return typeof full === 'string' && full.startsWith(partial);
        if (Array.isArray(partial)) {
            return Array.isArray(full) && partial.length <= full.length && partial.every((v, i) => isPrefix(v, full[i]));
        }
        if (partial && typeof partial === 'object') {
            return !!full && typeof full === 'object' && !Array.isArray(full) &&
                Object.keys(partial).every(k => k in full && isPrefix(partial[k], full[k]));
        }
        return partial === full;
    }

    const documents = {
        'geçerli JSON': JSON.stringify({
            title: 'Başlık "tırnaklı" \\ ters bölü\nsatır',
            n: [1, -2, 3.5, 1.5e-3, 12345, 0],
            ok: true,
            no: false,
            nothing: null,
            nested: { list: [{ a: 1 }, { b: [true, null, 'x'] }], empty: {}, emptyArr: [] },
            uni: 'é😀 “akıllı” é',
        }, null, 2),
        'LLM çıktısı': 'Elbette, işte JSON:\n```json\n{\n  "name": "Ali",\n  "age": 30,\n  "tags": ["a", "b", "c"],\n  "active": true,\n  "score": 4.75\n}\n```\nUmarım yardımcı olur!',
        'bozuk JSON': "{ name: 'Ali', age: 30, tags: ['a' 'b' 'c'], // yorum\n  active: True, manager: None, /* not */ score: 4.75, }",
    };

    for (const [name, text] of Object.entries(documents)) {
        test(name, () => {
            const full = loads(text, stable);
            expect(full).not.toBe('');

            let previous;
            for (let i = 1; i <= text.length; i++) {
                const prefix = text.slice(0, i);
                const result = loads(prefix, stable);
                if (result === '') continue; // henüz JSON başlamadı
                if (!isPrefix(result, full)) {
                    throw new Error(`Prefix is not stable at ${i}:\n${JSON.stringify(prefix)}\n=> ${JSON.stringify(result)}\nfinal: ${JSON.stringify(full)}`);
                }
                if (previous !== undefined && !isPrefix(previous, result)) {
                    throw new Error(`Result shrank or changed at ${i}:\n${JSON.stringify(prefix)}\n=> ${JSON.stringify(result)}\nprevious: ${JSON.stringify(previous)}`);
                }
                previous = result;
            }
        });
    }
});
