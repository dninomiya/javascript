import type { JwtPayload } from '@clerk/types';

import { createBackendApiClient } from '../api';
import type { SignedInAuthObject, SignedOutAuthObject } from './authObjects';
import { signedInAuthObject, signedOutAuthObject } from './authObjects';
import type { TokenVerificationErrorReason } from './errors';

import { constants } from '../constants';

export enum AuthStatus {
  SignedIn = 'signed-in',
  SignedOut = 'signed-out',
  Interstitial = 'interstitial',
  Unknown = 'unknown',
}

export type SignedInState = {
  status: AuthStatus.SignedIn;
  reason: null;
  message: null;
  frontendApi: string;
  proxyUrl?: string;
  publishableKey: string;
  isSatellite: boolean;
  domain: string;
  isSignedIn: true;
  isInterstitial: false;
  isUnknown: false;
  toAuth: () => SignedInAuthObject;
};

export type SignedOutState = {
  status: AuthStatus.SignedOut;
  message: string;
  reason: AuthReason;
  frontendApi: string;
  proxyUrl?: string;
  publishableKey: string;
  isSatellite: boolean;
  domain: string;
  isSignedIn: false;
  isInterstitial: false;
  isUnknown: false;
  toAuth: () => SignedOutAuthObject;
};

export type InterstitialState = Omit<SignedOutState, 'isInterstitial' | 'status' | 'toAuth'> & {
  status: AuthStatus.Interstitial;
  isInterstitial: true;
  toAuth: () => null;
};

export type UnknownState = Omit<InterstitialState, 'status' | 'isInterstitial' | 'isUnknown'> & {
  status: AuthStatus.Unknown;
  isInterstitial: false;
  isUnknown: true;
};

export enum AuthErrorReason {
  CookieAndUATMissing = 'cookie-and-uat-missing',
  CookieMissing = 'cookie-missing',
  CookieOutDated = 'cookie-outdated',
  CookieUATMissing = 'uat-missing',
  CrossOriginReferrer = 'cross-origin-referrer',
  HeaderMissingCORS = 'header-missing-cors',
  HeaderMissingNonBrowser = 'header-missing-non-browser',
  SatelliteCookieNeedsSyncing = 'satellite-needs-syncing',
  StandardSignedIn = 'standard-signed-in',
  StandardSignedOut = 'standard-signed-out',
  UnexpectedError = 'unexpected-error',
  Unknown = 'unknown',
}

export type AuthReason = AuthErrorReason | TokenVerificationErrorReason;

export type RequestState = SignedInState | SignedOutState | InterstitialState | UnknownState;

export async function signedIn<T>(options: T, sessionClaims: JwtPayload): Promise<SignedInState> {
  const {
    apiKey,
    secretKey,
    apiUrl,
    apiVersion,
    cookieToken,
    frontendApi,
    proxyUrl,
    publishableKey,
    domain,
    isSatellite,
    headerToken,
    loadSession,
    loadUser,
    loadOrganization,
  } = options as any;

  const { sid: sessionId, org_id: orgId, sub: userId } = sessionClaims;

  const { sessions, users, organizations } = createBackendApiClient({
    apiKey,
    secretKey,
    apiUrl,
    apiVersion,
  });

  const [sessionResp, userResp, organizationResp] = await Promise.all([
    loadSession ? sessions.getSession(sessionId) : Promise.resolve(undefined),
    loadUser ? users.getUser(userId) : Promise.resolve(undefined),
    loadOrganization && orgId ? organizations.getOrganization({ organizationId: orgId }) : Promise.resolve(undefined),
  ]);

  const session = sessionResp;
  const user = userResp;
  const organization = organizationResp;
  // const session = sessionResp && !sessionResp.errors ? sessionResp.data : undefined;
  // const user = userResp && !userResp.errors ? userResp.data : undefined;
  // const organization = organizationResp && !organizationResp.errors ? organizationResp.data : undefined;

  const authObject = signedInAuthObject(
    sessionClaims,
    {
      secretKey,
      apiKey,
      apiUrl,
      apiVersion,
      token: cookieToken || headerToken || '',
      session,
      user,
      organization,
    },
    { ...options, status: AuthStatus.SignedIn },
  );

  return {
    status: AuthStatus.SignedIn,
    reason: null,
    message: null,
    frontendApi,
    proxyUrl,
    publishableKey,
    domain,
    isSatellite,
    isSignedIn: true,
    isInterstitial: false,
    isUnknown: false,
    toAuth: () => authObject,
  };
}

export function signedOut<T>(options: T, reason: AuthReason, message = ''): SignedOutState {
  const { frontendApi, publishableKey, proxyUrl, isSatellite, domain } = options as any;

  return {
    status: AuthStatus.SignedOut,
    reason,
    message,
    frontendApi,
    proxyUrl,
    publishableKey,
    isSatellite,
    domain,
    isSignedIn: false,
    isInterstitial: false,
    isUnknown: false,
    toAuth: () => signedOutAuthObject({ ...options, status: AuthStatus.SignedOut, reason, message }),
  };
}

export function interstitial<T>(options: T, reason: AuthReason, message = ''): InterstitialState {
  const { frontendApi, publishableKey, proxyUrl, isSatellite, domain } = options as any;
  return {
    status: AuthStatus.Interstitial,
    reason,
    message,
    frontendApi,
    publishableKey,
    isSatellite,
    domain,
    proxyUrl,
    isSignedIn: false,
    isInterstitial: true,
    isUnknown: false,
    toAuth: () => null,
  };
}

export function unknownState<T>(options: T, reason: AuthReason, message = ''): UnknownState {
  const { frontendApi, publishableKey, isSatellite, domain } = options as any;
  return {
    status: AuthStatus.Unknown,
    reason,
    message,
    frontendApi,
    publishableKey,
    isSatellite,
    domain,
    isSignedIn: false,
    isInterstitial: false,
    isUnknown: true,
    toAuth: () => null,
  };
}

type InjectHandler = (key: string, value: string) => void;
export function injectRequestState(requestState: RequestState, inject: InjectHandler) {
  const { status, message, reason } = requestState;
  status && inject(constants.Headers.AuthStatus, status);
  message && inject(constants.Headers.AuthMessage, message);
  reason && inject(constants.Headers.AuthReason, reason);
}

type RetrieveHandler<T> = (req: T, key: string) => string | null | undefined;
export function retrieveRequestState<TRequest>(req: TRequest, retrieve: RetrieveHandler<TRequest>) {
  const status = retrieve(req, constants.Headers.AuthStatus);
  const message = retrieve(req, constants.Headers.AuthMessage);
  const reason = retrieve(req, constants.Headers.AuthReason);

  return { status, message, reason };
}
