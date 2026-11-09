// Logo shown in Razorpay's payment window instead of the default letter box (the Anaa icon in client/public).
// Razorpay's window loads it in the customer's own browser, so a full address of this site is passed.
export const checkoutImage = () => `${window.location.origin}/favicon.png`;
