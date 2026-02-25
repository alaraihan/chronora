/**
 * Retries a failed payment for an existing order.
 * @param {string} orderId - The MongoDB ID of the order.
 * @param {number} amount - The total amount of the order.
 */
async function retryPayment(orderId, amount) {
    try {
        // 1. Get new Razorpay order details from server
        const response = await axios.get(`/profile/retry-payment/${orderId}`);

        if (!response.data.success) {
            return Swal.fire({
                icon: 'error',
                title: 'Retry Failed',
                text: response.data.message || 'Could not initiate payment retry.'
            });
        }

        const { order_id, key_id } = response.data;

        const options = {
            key: key_id,
            amount: amount * 100,
            currency: "INR",
            name: "CHRONORA",
            description: "Retry Purchase",
            order_id: order_id,
            handler: async function (response) {
                // 2. Verify payment on server
                try {
                    const verifyResponse = await axios.post('/profile/verify-retry-payment', {
                        orderId: orderId,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature
                    });

                    if (verifyResponse.data.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Payment Successful',
                            text: 'Your order has been confirmed!',
                            timer: 2000,
                            showConfirmButton: false
                        }).then(() => {
                            window.location.href = `/checkout/success?orderId=${orderId}`;
                        });
                    } else {
                        throw new Error(verifyResponse.data.message || 'Verification failed');
                    }
                } catch (err) {
                    console.error("Verification error:", err);
                    Swal.fire({
                        icon: 'error',
                        title: 'Verification Failed',
                        text: err.response?.data?.message || 'We could not verify your payment. Please contact support.'
                    });
                }
            },
            prefill: {
                name: "", // Can be filled if user name is available
                email: "",
                contact: ""
            },
            theme: {
                color: "#c9a96e"
            },
            modal: {
                ondismiss: function () {
                    console.log("Retry checkout dismissed");
                }
            }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
            Swal.fire({
                icon: 'error',
                title: 'Payment Failed',
                text: response.error.description
            });
        });
        rzp.open();

    } catch (error) {
        console.error("Retry payment error:", error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Something went wrong while initiating the payment.'
        });
    }
}

/**
 * Cancels an entire order.
 * @param {string} orderId - The MongoDB ID of the order.
 */
async function cancelEntireOrder(orderId) {
    try {
        const { value: reason } = await Swal.fire({
            title: 'Cancel Entire Order?',
            text: 'Please provide a reason for cancellation:',
            input: 'textarea',
            inputPlaceholder: 'Reason for cancellation...',
            inputAttributes: {
                'aria-label': 'Reason for cancellation'
            },
            showCancelButton: true,
            confirmButtonText: 'Yes, Cancel Order',
            confirmButtonColor: '#dc2626',
            cancelButtonText: 'No, Keep It',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'You need to provide a reason!';
                }
            }
        });

        if (reason) {
            Swal.fire({
                title: 'Cancelling...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const response = await axios.post(`/profile/orders/${orderId}/cancel`, { reason });

            if (response.data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Order Cancelled',
                    text: response.data.message || 'The entire order has been cancelled.',
                    timer: 2000,
                    showConfirmButton: false
                }).then(() => {
                    window.location.reload();
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Failed',
                    text: response.data.message || 'Could not cancel the order.'
                });
            }
        }
    } catch (error) {
        console.error("Cancel order error:", error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.response?.data?.message || 'Something went wrong while cancelling the order.'
        });
    }
}
