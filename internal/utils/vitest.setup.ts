// The app runs Temporal via `@internal/hermes-polyfills`, so this suite must
// exercise the polyfill production runs rather than Node's native Temporal.
import { installImplementation } from 'temporal-polyfill/shim';

installImplementation();
