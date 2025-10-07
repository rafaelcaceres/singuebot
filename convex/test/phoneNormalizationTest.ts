import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { normalizePhoneNumber, getPhoneVariations, arePhoneNumbersEquivalent } from "../utils/phoneNormalizer";

/**
 * Test function to validate phone number normalization with real Brazilian numbers
 * This helps ensure compatibility with existing data and new incoming messages
 */
export const testPhoneNormalization = internalQuery({
  args: {},
  returns: v.object({
    success: v.boolean(),
    results: v.array(v.object({
      testCase: v.string(),
      input: v.string(),
      expected: v.string(),
      actual: v.string(),
      passed: v.boolean(),
    })),
    summary: v.object({
      total: v.number(),
      passed: v.number(),
      failed: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const testCases = [
      // Test cases for Brazilian mobile numbers (SC - 48)
      {
        testCase: "Normalize 8-digit SC mobile to 9-digit",
        input: "whatsapp:+5548999330297",
        expected: "whatsapp:+5548999330297",
      },
      {
        testCase: "Normalize 8-digit SC mobile without prefix",
        input: "48999330297",
        expected: "whatsapp:+5548999330297",
      },
      {
        testCase: "Normalize old 8-digit SC mobile",
        input: "whatsapp:+554899330297",
        expected: "whatsapp:+5548999330297",
      },
      {
        testCase: "Normalize old 8-digit SC mobile without prefix",
        input: "4899330297",
        expected: "whatsapp:+5548999330297",
      },
      {
        testCase: "Handle already normalized number",
        input: "whatsapp:+5548999330297",
        expected: "whatsapp:+5548999330297",
      },
      // Test cases for São Paulo numbers (11)
      {
        testCase: "Normalize SP 8-digit mobile",
        input: "whatsapp:+551199999999",
        expected: "whatsapp:+5511999999999",
      },
      {
        testCase: "Normalize SP old 8-digit mobile",
        input: "whatsapp:+551199999999",
        expected: "whatsapp:+5511999999999",
      },
      // Test cases for landline numbers (should not be modified)
      {
        testCase: "Keep landline number unchanged",
        input: "whatsapp:+554833334444",
        expected: "whatsapp:+554833334444",
      },
      // Test cases for international numbers (should not be modified)
      {
        testCase: "Keep US number unchanged",
        input: "whatsapp:+15551234567",
        expected: "whatsapp:+15551234567",
      },
    ];

    const results = testCases.map(testCase => {
      const actual = normalizePhoneNumber(testCase.input);
      const passed = actual === testCase.expected;
      
      return {
        testCase: testCase.testCase,
        input: testCase.input,
        expected: testCase.expected,
        actual,
        passed,
      };
    });

    // Test phone variations
    const variationTests = [
      {
        testCase: "Get variations for SC mobile",
        input: "whatsapp:+5548999330297",
        expectedVariations: ["whatsapp:+5548999330297", "whatsapp:+554899330297"],
      },
      {
        testCase: "Get variations for SP mobile",
        input: "whatsapp:+5511999999999",
        expectedVariations: ["whatsapp:+5511999999999", "whatsapp:+551199999999"],
      },
    ];

    variationTests.forEach(test => {
      const variations = getPhoneVariations(test.input);
      const passed = variations.length === test.expectedVariations.length &&
                    test.expectedVariations.every(expected => variations.includes(expected));
      
      results.push({
        testCase: test.testCase,
        input: test.input,
        expected: test.expectedVariations.join(", "),
        actual: variations.join(", "),
        passed,
      });
    });

    // Test equivalence checking
    const equivalenceTests = [
      {
        testCase: "SC numbers are equivalent (9-digit vs 8-digit)",
        input: "whatsapp:+5548999330297",
        compareWith: "whatsapp:+554899330297",
        expected: "true",
      },
      {
        testCase: "SP numbers are equivalent (9-digit vs 8-digit)",
        input: "whatsapp:+5511999999999",
        compareWith: "whatsapp:+551199999999",
        expected: "true",
      },
      {
        testCase: "Different numbers are not equivalent",
        input: "whatsapp:+5548999330297",
        compareWith: "whatsapp:+5548888888888",
        expected: "false",
      },
    ];

    equivalenceTests.forEach(test => {
      const actual = arePhoneNumbersEquivalent(test.input, test.compareWith);
      const passed = actual.toString() === test.expected;
      
      results.push({
        testCase: test.testCase,
        input: `${test.input} vs ${test.compareWith}`,
        expected: test.expected,
        actual: actual.toString(),
        passed,
      });
    });

    const summary = {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
    };

    return {
      success: summary.failed === 0,
      results,
      summary,
    };
  },
});

/**
 * Test function to check database compatibility with existing participants
 */
export const testDatabaseCompatibility = internalQuery({
  args: {},
  returns: v.object({
    success: v.boolean(),
    existingParticipants: v.number(),
    potentialDuplicates: v.array(v.object({
      phone1: v.string(),
      phone2: v.string(),
      areEquivalent: v.boolean(),
    })),
    recommendations: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get all participants
    const participants = await ctx.db.query("participants").collect();
    
    // Check for potential duplicates based on phone number equivalence
    const potentialDuplicates = [];
    const recommendations = [];

    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const phone1 = participants[i].phone;
        const phone2 = participants[j].phone;
        
        if (arePhoneNumbersEquivalent(phone1, phone2)) {
          potentialDuplicates.push({
            phone1,
            phone2,
            areEquivalent: true,
          });
        }
      }
    }

    if (potentialDuplicates.length > 0) {
      recommendations.push(`Found ${potentialDuplicates.length} potential duplicate participants that should be merged`);
      recommendations.push("Consider running a data migration to consolidate equivalent phone numbers");
    }

    // Check for old format numbers that need normalization
    const oldFormatNumbers = participants.filter(p => {
      const normalized = normalizePhoneNumber(p.phone);
      return normalized !== p.phone;
    });

    if (oldFormatNumbers.length > 0) {
      recommendations.push(`Found ${oldFormatNumbers.length} participants with old format phone numbers`);
      recommendations.push("These will be automatically normalized when they send new messages");
    }

    return {
      success: potentialDuplicates.length === 0,
      existingParticipants: participants.length,
      potentialDuplicates,
      recommendations,
    };
  },
});