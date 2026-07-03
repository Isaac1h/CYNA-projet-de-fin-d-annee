import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import CheckoutStep1 from '@/components/CheckoutStep1';
import CheckoutStep2 from '@/components/CheckoutStep2';
import CheckoutStep3 from '@/components/CheckoutStep3';
import CheckoutStep4 from '@/components/CheckoutStep4';

const CheckoutPage = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [guestEmail, setGuestEmail] = useState('');
  const [formData, setFormData] = useState({});
  const [orderNumber, setOrderNumber] = useState('');
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { isAuthenticated, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (cartItems.length === 0 && currentStep < 4) {
      navigate('/cart');
    }
  }, [cartItems, currentStep, navigate]);

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      setFormData(prev => ({
        ...prev,
        fullName: currentUser.full_name || '',
        email: currentUser.email || ''
      }));
    } else if (guestEmail) {
      setFormData(prev => ({
        ...prev,
        email: guestEmail
      }));
    }
  }, [isAuthenticated, currentUser, guestEmail]);

  const handleStepComplete = () => {
    if (currentStep === 3) {
      // Generate order number
      const orderNum = 'ORD-' + Date.now().toString(36).toUpperCase();
      setOrderNumber(orderNum);

      // Save order (in real app, this would go to backend)
      const order = {
        orderNumber: orderNum,
        items: cartItems,
        total: getCartTotal(),
        billingInfo: formData,
        createdAt: new Date().toISOString(),
        status: 'Completed'
      };

      const orders = JSON.parse(localStorage.getItem('orders') || '[]');
      orders.push(order);
      localStorage.setItem('orders', JSON.stringify(orders));

      clearCart();
    }
    setCurrentStep(currentStep + 1);
  };

  const steps = [
    { number: 1, title: 'Authentification', component: CheckoutStep1 },
    { number: 2, title: 'Facturation', component: CheckoutStep2 },
    { number: 3, title: 'Paiement', component: CheckoutStep3 },
    { number: 4, title: 'Confirmation', component: CheckoutStep4 }
  ];

  return (
    <>
      <Helmet>
        <title>Paiement - Cyna</title>
        <meta name="description" content="Finalisez votre achat" />
      </Helmet>

      <div className="min-h-screen bg-background py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Step Indicator */}
          <div className="mb-12">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <React.Fragment key={step.number}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                        currentStep > step.number
                          ? 'bg-green-600 text-white'
                          : currentStep === step.number
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {currentStep > step.number ? <Check className="w-6 h-6" /> : step.number}
                    </div>
                    <span className="text-sm text-muted-foreground mt-2 hidden sm:block">{step.title}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 transition-all duration-300 ${
                        currentStep > step.number ? 'bg-green-600' : 'bg-secondary'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div>
            {currentStep === 1 && (
              <CheckoutStep1
                onNext={handleStepComplete}
                guestEmail={guestEmail}
                setGuestEmail={setGuestEmail}
              />
            )}
            {currentStep === 2 && (
              <CheckoutStep2
                formData={formData}
                setFormData={setFormData}
                onNext={handleStepComplete}
                onBack={() => setCurrentStep(1)}
              />
            )}
            {currentStep === 3 && (
              <CheckoutStep3
                onNext={handleStepComplete}
                onBack={() => setCurrentStep(2)}
                total={getCartTotal()}
              />
            )}
            {currentStep === 4 && (
              <CheckoutStep4 orderNumber={orderNumber} />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CheckoutPage;