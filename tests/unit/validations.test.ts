import { describe, it, expect } from 'vitest';
import {
  reserveSchema,
  pickupConfirmSchema,
  pickupVerifySchema,
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  reviewSchema,
} from '@/lib/validations';

describe('reserveSchema', () => {
  it('accepts a valid payload', () => {
    const r = reserveSchema.safeParse({
      listingId: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 2,
      paymentMethod: 'midtrans',
    });
    expect(r.success).toBe(true);
  });

  it('accepts payload without optional paymentMethod', () => {
    const r = reserveSchema.safeParse({
      listingId: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 1,
    });
    expect(r.success).toBe(true);
  });

  it('rejects non-UUID listingId', () => {
    const r = reserveSchema.safeParse({
      listingId: 'not-a-uuid',
      quantity: 1,
    });
    expect(r.success).toBe(false);
  });

  it('rejects quantity < 1', () => {
    const r = reserveSchema.safeParse({
      listingId: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 0,
    });
    expect(r.success).toBe(false);
  });

  it('rejects quantity > 10', () => {
    const r = reserveSchema.safeParse({
      listingId: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 11,
    });
    expect(r.success).toBe(false);
  });

  it('rejects non-integer quantity', () => {
    const r = reserveSchema.safeParse({
      listingId: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 1.5,
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid paymentMethod', () => {
    const r = reserveSchema.safeParse({
      listingId: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 1,
      paymentMethod: 'bitcoin',
    });
    expect(r.success).toBe(false);
  });
});

describe('pickupConfirmSchema + pickupVerifySchema', () => {
  const valid = 'ABC123';

  it('accepts a 6-char alphanumeric uppercase code', () => {
    expect(pickupConfirmSchema.safeParse({ pickupCode: valid }).success).toBe(true);
    expect(pickupVerifySchema.safeParse({ pickupCode: valid }).success).toBe(true);
  });

  it('accepts a 6-char numeric code', () => {
    expect(pickupConfirmSchema.safeParse({ pickupCode: '123456' }).success).toBe(true);
  });

  it('rejects short codes', () => {
    expect(pickupConfirmSchema.safeParse({ pickupCode: 'ABC12' }).success).toBe(false);
    expect(pickupVerifySchema.safeParse({ pickupCode: 'ABC12' }).success).toBe(false);
  });

  it('rejects long codes', () => {
    expect(pickupConfirmSchema.safeParse({ pickupCode: 'ABC1234' }).success).toBe(false);
  });

  it('rejects special chars in pickupVerifySchema', () => {
    expect(pickupVerifySchema.safeParse({ pickupCode: 'ABC-12' }).success).toBe(false);
    expect(pickupVerifySchema.safeParse({ pickupCode: 'AB 123' }).success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(pickupConfirmSchema.safeParse({ pickupCode: '' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts a valid email + 8-char password', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', password: '12345678' });
    expect(r.success).toBe(true);
  });

  it('rejects bad email', () => {
    const r = loginSchema.safeParse({ email: 'not-an-email', password: '12345678' });
    expect(r.success).toBe(false);
  });

  it('rejects password < 8 chars', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', password: 'short' });
    expect(r.success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const r = registerSchema.safeParse({
      email: 'a@b.com',
      password: '12345678',
      fullName: 'Alice',
      phone: '+628123456789',
      role: 'consumer',
    });
    expect(r.success).toBe(true);
  });

  it('accepts merchant role', () => {
    const r = registerSchema.safeParse({
      email: 'a@b.com',
      password: '12345678',
      fullName: 'Bob',
      phone: '+628123456789',
      role: 'merchant',
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown role', () => {
    const r = registerSchema.safeParse({
      email: 'a@b.com',
      password: '12345678',
      fullName: 'Bob',
      role: 'admin',
    });
    expect(r.success).toBe(false);
  });

  it('rejects fullName < 2 chars', () => {
    const r = registerSchema.safeParse({
      email: 'a@b.com',
      password: '12345678',
      fullName: 'A',
      role: 'consumer',
    });
    expect(r.success).toBe(false);
  });

  it('rejects fullName > 100 chars', () => {
    const r = registerSchema.safeParse({
      email: 'a@b.com',
      password: '12345678',
      fullName: 'A'.repeat(101),
      role: 'consumer',
    });
    expect(r.success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });
  it('rejects bad email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'no' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts matching 8-char passwords', () => {
    const r = resetPasswordSchema.safeParse({
      password: '12345678',
      confirmPassword: '12345678',
    });
    expect(r.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const r = resetPasswordSchema.safeParse({
      password: '12345678',
      confirmPassword: '87654321',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'confirmPassword')).toBe(true);
    }
  });

  it('rejects short passwords', () => {
    const r = resetPasswordSchema.safeParse({
      password: 'short',
      confirmPassword: 'short',
    });
    expect(r.success).toBe(false);
  });
});

describe('reviewSchema', () => {
  it('accepts rating 1-5', () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      const r = reviewSchema.safeParse({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        rating,
      });
      expect(r.success).toBe(true);
    }
  });

  it('rejects rating < 1', () => {
    const r = reviewSchema.safeParse({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
      rating: 0,
    });
    expect(r.success).toBe(false);
  });

  it('rejects rating > 5', () => {
    const r = reviewSchema.safeParse({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
      rating: 6,
    });
    expect(r.success).toBe(false);
  });

  it('accepts optional comment up to 500 chars', () => {
    const r = reviewSchema.safeParse({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
      rating: 5,
      comment: 'Great!',
    });
    expect(r.success).toBe(true);
  });

  it('rejects comment > 500 chars', () => {
    const r = reviewSchema.safeParse({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
      rating: 5,
      comment: 'A'.repeat(501),
    });
    expect(r.success).toBe(false);
  });
});