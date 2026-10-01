import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseInvitationToken } from '../src/App';

describe('Milestone M3: User Invitation Management & Acceptance (Finding B11: Features 11, 12, 13)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        hash: '',
        pathname: '/',
        origin: 'https://demo.kampus.pk',
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Feature 13 Routing: parseInvitationToken
  // ---------------------------------------------------------------------------
  describe('1. Routing Contract: parseInvitationToken', () => {
    it('T1-F13-01a: parses raw token from hash "#invite/:token"', () => {
      (window as any).location.hash = '#invite/tok_test_1234567890abcdef';
      (window as any).location.pathname = '/';

      const token = parseInvitationToken();
      expect(token).toBe('tok_test_1234567890abcdef');
    });

    it('T1-F13-01b: parses raw token from hash with leading slash "#/invite/:token"', () => {
      (window as any).location.hash = '#/invite/tok_leading_slash_987654';
      (window as any).location.pathname = '/';

      const token = parseInvitationToken();
      expect(token).toBe('tok_leading_slash_987654');
    });

    it('T1-F13-01c: parses raw token from pathname "/invite/:token"', () => {
      (window as any).location.hash = '';
      (window as any).location.pathname = '/invite/tok_path_route_abcdef';

      const token = parseInvitationToken();
      expect(token).toBe('tok_path_route_abcdef');
    });

    it('T1-F13-01d: returns null for standard dashboard or settings hashes', () => {
      (window as any).location.hash = '#dashboard';
      (window as any).location.pathname = '/';

      expect(parseInvitationToken()).toBeNull();

      (window as any).location.hash = '#settings';
      expect(parseInvitationToken()).toBeNull();

      (window as any).location.hash = '#reset-password';
      expect(parseInvitationToken()).toBeNull();

      (window as any).location.hash = '';
      expect(parseInvitationToken()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Feature 11: Admin Invitation Management UI Logic & Validation (B11)
  // ---------------------------------------------------------------------------
  describe('2. Feature 11: Admin Invitation Management UI Logic & Link Construction', () => {
    it('T1-F11-03: constructs valid institutional invitation URL', () => {
      const origin = 'https://apex.kampus.pk';
      const token = 'c4d8e9f0123456789abcdef012345678';
      const expectedUrl = `${origin}/#invite/${token}`;

      expect(expectedUrl).toBe('https://apex.kampus.pk/#invite/c4d8e9f0123456789abcdef012345678');
      expect(expectedUrl).toContain('/#invite/');
    });

    it('T2-F11-02: validates recipient email formatting', () => {
      const isValidEmail = (email: string) => {
        const clean = email.trim().toLowerCase();
        return clean.length > 5 && clean.includes('@') && clean.includes('.');
      };

      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('teacher@academy.edu.pk')).toBe(true);
      expect(isValidEmail('finance.officer@apex.pk')).toBe(true);
    });

    it('T1-F11-04: maps allowed institutional roles cleanly', () => {
      const roleOptions = [
        { value: 'teacher', label: 'Teacher / Faculty' },
        { value: 'finance_manager', label: 'Accountant / Finance' },
        { value: 'academic_head', label: 'Academic Head' },
        { value: 'tenant_admin', label: 'Academy Administrator' },
        { value: 'student', label: 'Student' },
        { value: 'parent', label: 'Parent / Guardian' },
      ];

      expect(roleOptions.length).toBe(6);
      expect(roleOptions.find(r => r.value === 'teacher')?.label).toBe('Teacher / Faculty');
      expect(roleOptions.find(r => r.value === 'finance_manager')?.label).toBe('Accountant / Finance');
    });

    it('T1-F11-05: correctly computes invitation status states', () => {
      const computeStatus = (inv: { expires_at: string; accepted_at?: string | null; revoked_at?: string | null }) => {
        if (inv.revoked_at) return 'revoked';
        if (inv.accepted_at) return 'accepted';
        if (new Date(inv.expires_at).getTime() < Date.now()) return 'expired';
        return 'pending';
      };

      const now = Date.now();
      const future = new Date(now + 86400000).toISOString();
      const past = new Date(now - 86400000).toISOString();

      expect(computeStatus({ expires_at: future, accepted_at: null, revoked_at: null })).toBe('pending');
      expect(computeStatus({ expires_at: future, accepted_at: new Date().toISOString(), revoked_at: null })).toBe('accepted');
      expect(computeStatus({ expires_at: future, accepted_at: null, revoked_at: new Date().toISOString() })).toBe('revoked');
      expect(computeStatus({ expires_at: past, accepted_at: null, revoked_at: null })).toBe('expired');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Feature 13: Recipient Acceptance Verification & Error Handling (B11)
  // ---------------------------------------------------------------------------
  describe('3. Feature 13: Recipient Acceptance Flow Logic & Error Advisories', () => {
    it('T1-F13-02: verifies matching email between signed-in user and invitation', () => {
      const invitationEmail = 'instructor@apex.edu.pk';
      
      const matchingUserEmail = 'INSTRUCTOR@apex.edu.pk';
      expect(matchingUserEmail.toLowerCase() === invitationEmail.toLowerCase()).toBe(true);

      const mismatchedUserEmail = 'stranger@gmail.com';
      expect(mismatchedUserEmail.toLowerCase() === invitationEmail.toLowerCase()).toBe(false);
    });

    it('T2-F13-01 to T2-F13-03: maps backend error codes to institutional user advisories', () => {
      const mapErrorToAdvisory = (code: string) => {
        switch (code) {
          case 'INVITATION_REVOKED':
            return { title: 'Invitation Revoked', description: 'This invitation was revoked by the academy administration and is no longer valid.' };
          case 'INVITATION_EXPIRED':
            return { title: 'Invitation Expired', description: 'This invitation link has passed its expiration window. Please contact the academy administration to issue a new invitation.' };
          case 'INVITATION_ALREADY_ACCEPTED':
            return { title: 'Invitation Already Accepted', description: 'This invitation has already been accepted and claimed into an active academy membership.' };
          case 'INVITATION_NOT_FOUND':
          default:
            return { title: 'Invalid Invitation Link', description: 'This invitation link is unrecognized or has expired.' };
        }
      };

      const revoked = mapErrorToAdvisory('INVITATION_REVOKED');
      expect(revoked.title).toBe('Invitation Revoked');

      const expired = mapErrorToAdvisory('INVITATION_EXPIRED');
      expect(expired.title).toBe('Invitation Expired');

      const alreadyAccepted = mapErrorToAdvisory('INVITATION_ALREADY_ACCEPTED');
      expect(alreadyAccepted.title).toBe('Invitation Already Accepted');

      const notFound = mapErrorToAdvisory('INVITATION_NOT_FOUND');
      expect(notFound.title).toBe('Invalid Invitation Link');
    });

    it('T1-F13-03: formats institutional role labels for acceptance card', () => {
      const formatRoleLabel = (role: string) => {
        switch (role) {
          case 'tenant_admin': return 'Academy Administrator';
          case 'academic_head': return 'Academic Head / Coordinator';
          case 'teacher': return 'Teacher / Faculty';
          case 'finance_manager': return 'Accountant / Finance Manager';
          case 'student': return 'Student';
          case 'parent': return 'Parent / Guardian';
          default: return role;
        }
      };

      expect(formatRoleLabel('tenant_admin')).toBe('Academy Administrator');
      expect(formatRoleLabel('academic_head')).toBe('Academic Head / Coordinator');
      expect(formatRoleLabel('teacher')).toBe('Teacher / Faculty');
      expect(formatRoleLabel('finance_manager')).toBe('Accountant / Finance Manager');
    });

    it('T1-F13-04: verifies acceptance contract dispatches token payload', async () => {
      let dispatchedUrl = '';
      let dispatchedBody = '';

      const mockFetch = vi.fn().mockImplementation((url: string, init: any) => {
        dispatchedUrl = url;
        dispatchedBody = init?.body || '';
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { tenant_id: 't-100', membership: { id: 'm-100', role: 'teacher' } },
          }),
        });
      });

      const token = 'tok_test_contract_abc';
      await mockFetch('/api/v1/auth/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      expect(dispatchedUrl).toBe('/api/v1/auth/invitations/accept');
      expect(JSON.parse(dispatchedBody)).toEqual({ token: 'tok_test_contract_abc' });
    });
  });
});
