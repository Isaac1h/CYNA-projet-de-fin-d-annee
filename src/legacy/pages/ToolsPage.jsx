import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const ToolsPage = () => {
  const [contactForm, setContactForm] = useState({ email: '', subject: '', message: '' });
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const faqResponses = {
    'what is soc': 'SOC (Centre des Opérations de Sécurité) est une unité centralisée qui traite les problèmes de sécurité au niveau organisationnel et technique.',
    'how to activate edr': 'Pour activer l\'EDR, veuillez contacter notre équipe support ou vous référer à la documentation fournie avec votre abonnement.',
    'pricing options': 'Nous offrons des options de tarification mensuelle, annuelle et par utilisateur. Visitez notre catalogue pour voir les prix spécifiques pour chaque produit.',
    'soc': 'SOC (Centre des Opérations de Sécurité) est une unité centralisée qui traite les problèmes de sécurité au niveau organisationnel et technique.',
    'edr': 'Pour activer l\'EDR, veuillez contacter notre équipe support ou vous référer à la documentation fournie avec votre abonnement.',
    'prix': 'Nous offrons des options de tarification mensuelle, annuelle et par utilisateur. Visitez notre catalogue pour voir les prix spécifiques pour chaque produit.',
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Save to localStorage
    const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
    contacts.push({
      ...contactForm,
      created_at: new Date().toISOString()
    });
    localStorage.setItem('contacts', JSON.stringify(contacts));

    await new Promise(resolve => setTimeout(resolve, 1000));

    setLoading(false);
    setContactForm({ email: '', subject: '', message: '' });
    
    toast({
      title: 'Message envoyé !',
      description: 'Nous vous répondrons dans les 24 heures.',
    });
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);

    // Simple FAQ matching
    const query = chatInput.toLowerCase();
    let botResponse = 'Je suis désolé, je n\'ai pas d\'informations à ce sujet. Veuillez utiliser le formulaire de contact pour des demandes spécifiques.';
    
    for (const [key, value] of Object.entries(faqResponses)) {
      if (query.includes(key)) {
        botResponse = value;
        break;
      }
    }

    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: 'bot', content: botResponse }]);
    }, 500);

    setChatInput('');
  };

  const handleEscalate = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({
      title: 'Redirigé vers le formulaire de contact',
      description: 'Veuillez remplir le formulaire ci-dessous pour une assistance personnalisée.',
    });
  };

  return (
    <>
      <Helmet>
        <title>Outils & Support - Cyna</title>
        <meta name="description" content="Contactez-nous ou utilisez notre chatbot pour des réponses rapides" />
      </Helmet>

      <div className="min-h-screen bg-background py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-foreground mb-8 text-center">Outils & Support</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Contact Form */}
            <div className="bg-card border border-border rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-foreground mb-6">Contactez-nous</h2>
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="contact-email" className="text-foreground">Email</Label>
                  <input
                    id="contact-email"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    required
                    className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                    placeholder="votre@email.com"
                  />
                </div>

                <div>
                  <Label htmlFor="subject" className="text-foreground">Sujet</Label>
                  <input
                    id="subject"
                    type="text"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    required
                    className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                    placeholder="Comment pouvons-nous vous aider ?"
                  />
                </div>

                <div>
                  <Label htmlFor="message" className="text-foreground">Message</Label>
                  <textarea
                    id="message"
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    required
                    rows={6}
                    className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground resize-none placeholder:text-muted-foreground"
                    placeholder="Votre message..."
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {loading ? 'Envoi...' : 'Envoyer Message'}
                </Button>
              </form>
            </div>

            {/* Chatbot */}
            <div className="bg-card border border-border rounded-lg shadow-lg p-8 flex flex-col">
              <h2 className="text-2xl font-bold text-foreground mb-6">Assistant IA</h2>
              
              <div className="flex-1 bg-secondary rounded-lg p-4 mb-4 overflow-y-auto max-h-96">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p>Posez-moi des questions sur nos services !</p>
                    <div className="mt-4 space-y-2">
                      <button
                        onClick={() => setChatInput('Qu\'est-ce que le SOC ?')}
                        className="block w-full text-left px-4 py-2 bg-card border border-border rounded-lg hover:bg-secondary text-sm text-foreground transition-colors"
                      >
                        Qu'est-ce que le SOC ?
                      </button>
                      <button
                        onClick={() => setChatInput('Comment activer l\'EDR ?')}
                        className="block w-full text-left px-4 py-2 bg-card border border-border rounded-lg hover:bg-secondary text-sm text-foreground transition-colors"
                      >
                        Comment activer l'EDR ?
                      </button>
                      <button
                        onClick={() => setChatInput('Options de tarification ?')}
                        className="block w-full text-left px-4 py-2 bg-card border border-border rounded-lg hover:bg-secondary text-sm text-foreground transition-colors"
                      >
                        Options de tarification ?
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card border border-border text-foreground'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Tapez votre question..."
                  className="flex-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Send className="w-4 h-4" />
                </Button>
              </form>

              <Button
                onClick={handleEscalate}
                variant="outline"
                className="mt-4 w-full"
              >
                Besoin de plus d'aide ? Contactez le support
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ToolsPage;