'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  movieId: string;
  movieTitle: string;
  movieSlug: string;
}

const PAYMENT_METHODS = [
  {
    id: 'bank_transfer',
    name: 'Bank Transfer / QR Pay',
    icon: '🏦',
    subtext: 'Rs. 350.00 • Slip Required',
    qrImage: '/qrpay.jpeg',
    details: [
      { label: 'Bank Name', value: 'Dialog Finance PLC' },
      { label: 'Account Name', value: 'R M V R R G RATHNAYAKA' },
      { label: 'Account Number', value: '0010 2320 5120' },
      { label: 'Amount to Pay', value: 'Rs. 350.00' },
    ],
    instructions: 'Scan the QR code or deposit/transfer Rs. 350 to the Dialog Finance account above. Keep your printed or digital receipt slip (Image or PDF).',
  },
  {
    id: 'binance_pay',
    name: 'Binance Pay',
    icon: '🔶',
    subtext: '$1.00 USDT • Slip Required',
    details: [
      { label: 'Binance Pay ID', value: '108852963 ( DUBLK )' },
      { label: 'Account Name', value: 'DUBLK' },
      { label: 'Amount to Pay', value: '$1.00 USDT' },
    ],
    instructions: 'Send $1.00 USDT via Binance Pay to Pay ID 108852963 (DUBLK). Upload a screenshot of the payment confirmation.',
  },
  {
    id: 'bybit_pay',
    name: 'ByBit Pay',
    icon: '⚡',
    subtext: '$1.00 USDT • Slip Required',
    details: [
      { label: 'ByBit Pay ID', value: '254116167 ( DUBLK )' },
      { label: 'Account Name', value: 'DUBLK' },
      { label: 'Amount to Pay', value: '$1.00 USDT' },
    ],
    instructions: 'Send $1.00 USDT via ByBit Pay to Pay ID 254116167 (DUBLK). Upload a screenshot of the payment confirmation.',
  },
];

type Step = 'plans' | 'payment' | 'proof';

export default function PricingModal({ isOpen, onClose, movieTitle, movieSlug }: PricingModalProps) {
  const { user, openAuthModal } = useAuth();
  const [step, setStep] = useState<Step>('plans');
  const [selectedPlan, setSelectedPlan] = useState<'single' | 'full' | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Pending purchase state
  const [pendingPurchase, setPendingPurchase] = useState<any | null>(null);
  const [checkingPending, setCheckingPending] = useState(false);

  const supabase = createClient();

  // Check if user has an active pending payment slip under review
  useEffect(() => {
    if (!isOpen || !user?.id) {
      setPendingPurchase(null);
      setCheckingPending(false);
      return;
    }

    const userId = user.id;
    let isMounted = true;
    setCheckingPending(true);

    async function checkPendingPayment() {
      try {
        const { data, error } = await supabase
          .from('purchases')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0 && isMounted) {
          setPendingPurchase(data[0]);
        } else if (isMounted) {
          setPendingPurchase(null);
        }
      } catch (err) {
        console.error('[checkPendingPayment] error:', err);
      } finally {
        if (isMounted) setCheckingPending(false);
      }
    }

    checkPendingPayment();
  }, [isOpen, user, supabase]);

  if (!isOpen) return null;

  const handleFreeTrial = () => {
    handleClose();
    window.location.href = `/watch/${movieSlug}?mode=free`;
  };

  const handleSelectPlan = (plan: 'single' | 'full') => {
    setSelectedPlan(plan);
    setStep('payment');
  };

  const handleSelectPayment = (methodId: string) => {
    setSelectedMethod(methodId);
    if (!user) {
      openAuthModal(() => {
        setStep('proof');
      });
      return;
    }
    setStep('proof');
  };

  const handleBack = () => {
    if (step === 'proof') {
      setStep('payment');
    } else if (step === 'payment') {
      setStep('plans');
      setSelectedPlan(null);
      setSelectedMethod(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit. Please choose a smaller image or PDF.');
      return;
    }

    setError('');
    setProofFile(file);
    const pdfCheck = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setIsPdf(pdfCheck);

    // Generate local preview Data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!user) {
      openAuthModal(() => {});
      return;
    }
    if (!selectedPlan || !selectedMethod || !proofFile) {
      setError('Please attach your payment receipt slip (Image or PDF)');
      return;
    }

    setUploading(true);
    setError('');

    try {
      let finalProofUrl = proofPreview || '';

      // Try uploading file to Supabase storage bucket 'payment-proofs'
      try {
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_slip.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(fileName, proofFile, { upsert: true });

        if (!uploadError) {
          const { data: publicData } = supabase.storage
            .from('payment-proofs')
            .getPublicUrl(fileName);
          if (publicData?.publicUrl) {
            finalProofUrl = publicData.publicUrl;
          }
        }
      } catch {
        // Fallback to base64 preview URL for 100% upload guarantee
      }

      const newPurchase = {
        user_id: user.id,
        movie_id: null,
        type: 'full',
        amount: 350,
        payment_method: selectedMethod,
        payment_proof_url: finalProofUrl,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      // Create pending purchase record for Admin review
      const { error: insertError } = await supabase.from('purchases').insert(newPurchase);

      if (insertError) throw insertError;

      setPendingPurchase(newPurchase);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit payment slip. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setStep('plans');
    setSelectedPlan(null);
    setSelectedMethod(null);
    setProofFile(null);
    setProofPreview(null);
    setIsPdf(false);
    setSuccess(false);
    setError('');
    onClose();
  };

  const selectedMethodInfo = PAYMENT_METHODS.find(m => m.id === selectedMethod);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="rounded-2xl border border-white/10 bg-dark-900/95 backdrop-blur-xl shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500 to-transparent" />

          <div className="p-6 sm:p-8">
            {/* Close */}
            <button onClick={handleClose} className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {checkingPending ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner text="Checking payment status..." />
              </div>
            ) : pendingPurchase ? (
              /* ===== REVIEW IN PROGRESS STATE ===== */
              <div className="text-center py-4 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <span className="text-3xl">⏳</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-bold mb-3">
                  ● Review in Progress / පරීක්ෂා කරමින් පවතී
                </div>
                <h3 className="text-xl font-display font-bold text-white mb-2">
                  ඔබගේ Payment Slip එක පරීක්ෂා කරමින් පවතී
                </h3>
                <p className="text-dark-300 text-sm mb-2 leading-relaxed">
                  ඔබ විසින් ලබා දුන් Payment Slip එක අපගේ Admin කණ්ඩායම විසින් පරීක්ෂා කරමින් පවතී. පරීක්ෂාවෙන් පසු ඔබගේ VIP Lifetime Access නොබෝ වේලාවකින් සක්‍රිය වනු ඇත.
                </p>
                <p className="text-xs text-dark-400 mb-6">
                  Your payment slip is currently under review by our admin team. Your VIP access will be unlocked automatically upon approval.
                </p>

                {/* Receipt Summary Card */}
                <div className="p-4 rounded-xl bg-dark-800/80 border border-white/10 text-left mb-6 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-dark-400">Payment Status:</span>
                    <span className="font-semibold text-amber-400 flex items-center gap-1">
                      <span>⏳</span> Pending Verification
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-dark-400">Method:</span>
                    <span className="font-semibold text-white uppercase">{pendingPurchase.payment_method || 'Bank Transfer'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-dark-400">Amount:</span>
                    <span className="font-semibold text-green-400">{formatCurrency(pendingPurchase.amount || 350)}</span>
                  </div>
                  {pendingPurchase.created_at && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-dark-400">Submitted:</span>
                      <span className="text-dark-300">{new Date(pendingPurchase.created_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleFreeTrial}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 font-semibold hover:bg-emerald-600/30 transition-all text-xs"
                  >
                    🎬 Continue Watching Free Version (Ads)
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3 px-4 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-all text-xs"
                  >
                    Got It
                  </button>
                </div>
              </div>
            ) : success ? (
              /* ===== SUCCESS SUBMISSION STATE ===== */
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-display font-bold text-white mb-2">Payment Slip Submitted!</h3>
                <p className="text-dark-300 text-sm mb-4">
                  අපගේ Admin කණ්ඩායම ඔබගේ Payment Slip එක පරීක්ෂා කර (Review) නොබෝ වේලාවකින් VIP Lifetime Access සක්‍රිය කරනු ඇත.
                </p>
                <p className="text-xs text-dark-400 mb-6">
                  Your slip has been sent to the admin dashboard for verification. Access will be unlocked shortly upon approval.
                </p>
                <button onClick={handleClose} className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-500 transition-colors">
                  Got it
                </button>
              </div>
            ) : (
              <>
                {/* Step Progress */}
                <div className="flex items-center gap-2 mb-6">
                  {step !== 'plans' && (
                    <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-white/5 text-dark-400 hover:text-white transition-all mr-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  <div className="flex items-center gap-2 flex-1">
                    {(['plans', 'payment', 'proof'] as Step[]).map((s, i) => (
                      <div key={s} className="flex items-center gap-2 flex-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                          step === s
                            ? 'bg-brand-500 text-white ring-2 ring-brand-500/30'
                            : i < ['plans', 'payment', 'proof'].indexOf(step)
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-dark-700 text-dark-500'
                        }`}>
                          {i < ['plans', 'payment', 'proof'].indexOf(step) ? '✓' : i + 1}
                        </div>
                        {i < 2 && (
                          <div className={`flex-1 h-0.5 rounded-full transition-all ${
                            i < ['plans', 'payment', 'proof'].indexOf(step)
                              ? 'bg-green-500/30'
                              : 'bg-dark-700'
                          }`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ===== STEP 1: CHOOSE PLAN ===== */}
                {step === 'plans' && (
                  <div className="animate-fade-in">
                    <h2 className="text-xl font-display font-bold text-white mb-1">Choose a Plan</h2>
                    <p className="text-sm text-dark-400 mb-6">Select how you want to watch &quot;{movieTitle}&quot;</p>

                    <div className="space-y-3">
                      {/* FREE */}
                      <button
                        onClick={handleFreeTrial}
                        className="w-full p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60 hover:bg-emerald-500/10 text-left transition-all duration-200 relative overflow-hidden"
                      >
                        <div className="absolute -top-px -right-px px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-bl-xl">
                          FREE
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">🎬</span>
                              <h3 className="text-base font-semibold text-white">Continue with Free</h3>
                            </div>
                            <p className="text-xs text-dark-400">Watch instantly — no sign-up required</p>
                            <div className="flex flex-col gap-0.5 mt-1.5">
                              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                                <span>✓</span> All movies &amp; series — no payment ever
                              </p>
                              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                                <span>✓</span> No sign-up needed
                              </p>
                              <p className="text-[11px] text-dark-500 flex items-center gap-1">
                                <span>✗</span> Includes ads
                              </p>
                            </div>
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            <p className="text-3xl font-bold text-emerald-400">FREE</p>
                            <p className="text-[10px] text-dark-500">with ads</p>
                          </div>
                        </div>
                      </button>

                      {/* VIP — Rs.350 / $1 Lifetime */}
                      <button
                        onClick={() => handleSelectPlan('full')}
                        className="w-full p-5 rounded-xl border border-brand-500/30 bg-brand-500/5 hover:border-brand-500/60 hover:bg-brand-500/10 text-left transition-all duration-200 relative overflow-hidden"
                      >
                        <div className="absolute -top-px -right-px px-3 py-1 bg-gradient-to-r from-brand-600 to-amber-500 text-white text-[10px] font-bold rounded-bl-xl">
                          👑 VIP LIFETIME
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">⚡</span>
                              <h3 className="text-base font-semibold text-white">VIP — Lifetime Access</h3>
                            </div>
                            <p className="text-xs text-dark-400">Pay Rs. 350 or $1 USDT &amp; upload receipt slip</p>
                            <div className="flex flex-col gap-0.5 mt-1.5">
                              <p className="text-[11px] text-brand-300 flex items-center gap-1">
                                <span>✓</span> Ad-free streaming on movies &amp; series
                              </p>
                              <p className="text-[11px] text-brand-300 flex items-center gap-1">
                                <span>✓</span> Lifetime VIP access for all content
                              </p>
                              <p className="text-[11px] text-brand-300 flex items-center gap-1">
                                <span>✓</span> Direct Admin review &amp; activation
                              </p>
                            </div>
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            <p className="text-2xl sm:text-3xl font-bold text-white">Rs. 350 / $1</p>
                            <p className="text-[10px] text-dark-500">lifetime one-time</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* ===== STEP 2: PAYMENT METHOD ===== */}
                {step === 'payment' && (
                  <div className="animate-fade-in">
                    <h2 className="text-xl font-display font-bold text-white mb-1">Payment Method</h2>
                    <p className="text-sm text-dark-400 mb-1">
                      VIP Lifetime Access — <span className="text-brand-400 font-semibold">Rs. 350 / $1</span>
                    </p>
                    <p className="text-xs text-dark-500 mb-6">Select where you want to deposit or transfer payment</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PAYMENT_METHODS.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => handleSelectPayment(method.id)}
                          className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5 hover:border-brand-500/40 hover:bg-brand-500/5 text-left transition-all duration-200"
                        >
                          <span className="text-2xl">{method.icon}</span>
                          <div>
                            <span className="text-sm font-medium text-white block">{method.name}</span>
                            <span className="text-[10px] text-dark-400">{method.subtext}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ===== STEP 3: UPLOAD SLIP ===== */}
                {step === 'proof' && (
                  <div className="animate-fade-in">
                    <h2 className="text-xl font-display font-bold text-white mb-1">Upload Payment Slip</h2>
                    <p className="text-xs text-dark-500 mb-4">
                      VIP Lifetime Access via {selectedMethodInfo?.name}
                    </p>

                    {/* Payment Account Details */}
                    {selectedMethodInfo && (
                      <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 mb-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{selectedMethodInfo.icon}</span>
                          <p className="text-sm font-semibold text-brand-300">{selectedMethodInfo.name}</p>
                        </div>

                        {selectedMethodInfo.qrImage && (
                          <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl my-2 border border-brand-500/20 shadow-md">
                            <img src={selectedMethodInfo.qrImage} alt="QR Pay" className="w-52 h-auto rounded-lg object-contain" />
                            <span className="text-xs font-bold text-gray-900 mt-2">Scan QR Code to Pay (Dialog Finance / LankaQR)</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 py-2 border-y border-white/5">
                          {selectedMethodInfo.details.map((d, idx) => (
                            <div key={idx} className="bg-dark-900/60 p-2 rounded-lg border border-white/5">
                              <p className="text-[10px] text-dark-400 font-medium">{d.label}</p>
                              <p className="text-xs font-mono font-bold text-white select-all">{d.value}</p>
                            </div>
                          ))}
                        </div>

                        <p className="text-xs text-brand-200/80 leading-relaxed">
                          📌 {selectedMethodInfo.instructions}
                        </p>
                      </div>
                    )}

                    {/* Upload Area */}
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/15 rounded-xl cursor-pointer hover:border-brand-500/40 bg-white/5 transition-all mb-5">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      {proofFile ? (
                        <div className="text-center w-full">
                          {isPdf ? (
                            <div className="flex flex-col items-center">
                              <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-2">
                                <span className="text-2xl">📄</span>
                              </div>
                              <p className="text-sm font-semibold text-white truncate max-w-xs">{proofFile.name}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 mt-1 font-mono">
                                PDF Document ({(proofFile.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              {proofPreview && (
                                <img
                                  src={proofPreview}
                                  alt="Receipt Slip Preview"
                                  className="max-h-36 rounded-lg border border-white/10 mb-2 object-contain"
                                />
                              )}
                              <p className="text-sm font-semibold text-white truncate max-w-xs">{proofFile.name}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30 mt-1 font-mono">
                                Image Receipt ({(proofFile.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                          )}
                          <p className="text-[11px] text-brand-400 mt-2 hover:underline">Click to change attachment</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mx-auto mb-3 text-2xl">
                            📤
                          </div>
                          <p className="text-sm font-medium text-white">Upload Payment Receipt Slip</p>
                          <p className="text-xs text-dark-400 mt-1">PNG, JPG, WEBP Image or PDF Document (Up to 10MB)</p>
                        </div>
                      )}
                    </label>

                    {error && (
                      <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {error}
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      onClick={handleSubmit}
                      disabled={!proofFile || uploading}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:from-brand-500 hover:to-brand-400 transition-all duration-200 shadow-lg shadow-brand-500/25"
                    >
                      {uploading ? 'Uploading & Submitting...' : 'Submit Receipt Slip for Admin Review'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
