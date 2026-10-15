import { describe, expect, it } from 'vitest'
import { cleanDescription, guessCategory, guessMapping, merchantKey, parseAmount, parseCSV, parseDate, readStatement } from './csv'

describe('parseCSV', () => {
  it('handles quotes, embedded commas and newlines, and other separators', () => {
    expect(parseCSV('a,b,c\n"1,000","say ""hi""",x\r\n"multi\nline",2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1,000', 'say "hi"', 'x'],
      ['multi\nline', '2', '3'],
    ])
    expect(parseCSV('﻿Date;Amount\n01/10/2026;500')).toEqual([['Date', 'Amount'], ['01/10/2026', '500']])
    expect(parseCSV('Date\tAmount\n01/10/2026\t500\n\n')).toEqual([['Date', 'Amount'], ['01/10/2026', '500']])
  })
})

describe('parseDate', () => {
  it.each([
    ['05/10/2026', '2026-10-05'],
    ['05-10-26', '2026-10-05'],
    ['5.10.2026', '2026-10-05'],
    ['2026-10-05', '2026-10-05'],
    ['05 Oct 2026', '2026-10-05'],
    ['05-Oct-26', '2026-10-05'],
    ['Oct 5, 2026', '2026-10-05'],
    ['05/10/2026 14:32', '2026-10-05'],
  ])('%s', (input, expected) => {
    expect(parseDate(input)).toBe(expected)
  })
  it('respects month-first and rejects impossible dates', () => {
    expect(parseDate('10/05/2026', 'mdy')).toBe('2026-10-05')
    expect(parseDate('31/02/2026')).toBeNull()
    expect(parseDate('Opening balance')).toBeNull()
  })
})

describe('parseAmount', () => {
  it.each([
    ['₹1,23,456.78', 123456.78],
    ['-500', -500],
    ['(250.50)', -250.5],
    ['1,200.00 Dr', -1200],
    ['INR 900 CR', 900],
    ['Rs. 45', 45],
    ['', null],
    ['abc', null],
  ])('%s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })
})

describe('statements', () => {
  it('reads an HDFC-style statement with a preamble and separate columns', () => {
    const rows = parseCSV(`HDFC BANK Ltd.
Statement of account
Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/10/26,UPI-SWIGGY-swiggy@ybl-YESB0000001-429812345678-Payment,0000429812345678,01/10/26,450.00,,"1,00,000.00"
02/10/26,SALARY OCT 2026 ACME LTD,NEFT123,02/10/26,,"1,50,000.00","2,49,550.00"
03/10/26,POS 4567XXXXXX1234 AMAZON PAY IN,REF,03/10/26,"2,399.00",,"2,47,151.00"
Opening Balance,,,,,,
`)
    const map = guessMapping(rows)
    expect(map).toMatchObject({ headerRow: 2, date: 0, description: 1, amount: -1, debit: 4, credit: 5 })
    const { lines, skipped } = readStatement(rows, map)
    expect(lines).toEqual([
      { row: 4, date: '2026-10-01', description: 'Swiggy', amount: 450, type: 'expense' },
      { row: 5, date: '2026-10-02', description: 'SALARY OCT 2026 ACME LTD', amount: 150000, type: 'income' },
      { row: 6, date: '2026-10-03', description: 'Amazon Pay', amount: 2399, type: 'expense' },
    ])
    expect(skipped).toEqual([])
  })

  it('reads a card statement with one amount column and Cr markers', () => {
    const rows = parseCSV(`Transaction Date,Details,Amount (INR)
05 Oct 2026,NETFLIX.COM,649.00
06 Oct 2026,PAYMENT RECEIVED - THANK YOU,"10,000.00 Cr"
`)
    const map = guessMapping(rows)
    expect(map).toMatchObject({ headerRow: 0, date: 0, description: 1, amount: 2 })
    const { lines } = readStatement(rows, map)
    expect(lines.map((l) => [l.description, l.amount, l.type])).toEqual([
      ['NETFLIX.COM', 649, 'expense'],
      ['PAYMENT RECEIVED - THANK YOU', 10000, 'income'],
    ])
  })
})

describe('descriptions and categories', () => {
  it('cleans narrations and guesses categories', () => {
    expect(cleanDescription('UPI/DR/429812345678/ZEPTO MARKETPLACE/YESB/zepto@ybl/Pay')).toBe('Zepto Marketplace')
    expect(guessCategory('Zepto Marketplace', 'expense')).toBe('Groceries')
    expect(guessCategory('Uber India', 'expense')).toBe('Transport')
    expect(guessCategory('Random shop', 'expense')).toBeNull()
    expect(guessCategory('SALARY OCT', 'income')).toBe('Salary')
    expect(merchantKey('Swiggy Instamart 1234')).toBe('swiggy instamart')
  })
})
