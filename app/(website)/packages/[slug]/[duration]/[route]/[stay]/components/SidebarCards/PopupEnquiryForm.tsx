'use client'
import { useState } from 'react';
import Input from '@/app/components/forms/Input';
import Label from '@/app/components/forms/Label';
import Button from '@/app/components/ui/Button';
import { Text } from '@/app/components/ui/Typography';
import { submitPackageEnquiry } from '@/app/actions/enquiry/submit';
import { COUNTRY_CODES, DEFAULT_COUNTRY } from '@/app/lib/assets/country-codes';

type Props = {
    packageName: string;
    destination?: string;
    onSuccess?: () => void;
};

const TODAY = new Date().toISOString().split('T')[0];

type FormErrors = { name?: string; phone?: string };

export default function PopupEnquiryForm({ packageName, destination, onSuccess }: Props) {
    const [formData, setFormData] = useState({
        name:        '',
        countryCode: DEFAULT_COUNTRY.code,
        mobile:      '',
        travelDate:  '',
        travellers:  '',
    });
    const [errors,    setErrors]    = useState<FormErrors>({});
    const [formError, setFormError] = useState('');
    const [status,    setStatus]    = useState<'idle' | 'loading' | 'success'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const fe: FormErrors = {};
        if (!formData.name.trim()) fe.name = 'Name is required.';
        if (!formData.mobile.trim()) fe.phone = 'Phone number is required.';
        if (Object.keys(fe).length) { setErrors(fe); return; }

        const dial  = COUNTRY_CODES.find(c => c.code === formData.countryCode)?.dial ?? DEFAULT_COUNTRY.dial;
        const phone = dial + formData.mobile;

        setStatus('loading');
        setFormError('');

        const result = await submitPackageEnquiry({
            name:       formData.name,
            phone,
            countryCode: formData.countryCode,
            travelDate:  formData.travelDate  || undefined,
            travellers:  formData.travellers  ? Number(formData.travellers) : undefined,
            packageName,
            destination,
            packageUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
            pageUrl:    typeof window !== 'undefined' ? window.location.href     : undefined,
        });

        if (result.ok) {
            setStatus('success');
            onSuccess?.();
        } else if ('fieldErrors' in result && result.fieldErrors) {
            setErrors({ name: result.fieldErrors.name, phone: result.fieldErrors.phone });
            setStatus('idle');
        } else if ('formError' in result && result.formError) {
            setFormError(result.formError);
            setStatus('idle');
        }
    };

    if (status === 'success') {
        return (
            <div className="flex flex-col items-center text-center gap-3 py-6">
                <div className="size-14 rounded-full bg-success-50 flex items-center justify-center">
                    <svg className="size-7 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div>
                    <p className="font-semibold text-primary">We'll be in touch!</p>
                    <Text size="sm" intent="secondary" className="mt-0.5">Our travel expert will call you within 2 hours.</Text>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-3">

                {/* Name */}
                <div>
                    <Label htmlFor="peq-name" required>Full Name</Label>
                    <Input
                        id="peq-name"
                        placeholder="Your full name"
                        value={formData.name}
                        error={errors.name}
                        onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                        onBlur={() => {
                            if (!formData.name.trim()) setErrors(p => ({ ...p, name: 'Name is required.' }));
                            else setErrors(p => ({ ...p, name: undefined }));
                        }}
                    />
                </div>

                {/* Phone */}
                <div>
                    <Label htmlFor="peq-phone" required>Phone No.</Label>
                    <div className="flex gap-2">
                        <select
                            value={formData.countryCode}
                            onChange={e => setFormData(p => ({ ...p, countryCode: e.target.value }))}
                            className="h-11 w-24 shrink-0 rounded-xl bg-white px-2 text-sm font-medium text-(--text-primary) cursor-pointer ring-[0.09em] ring-inset ring-neutral-400/80 outline-none hover:ring-neutral-300 focus:ring-2 focus:ring-primary-400"
                        >
                            {COUNTRY_CODES.map(c => (
                                <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>
                            ))}
                        </select>
                        <Input
                            id="peq-phone"
                            type="tel"
                            inputMode="numeric"
                            placeholder="Mobile number"
                            value={formData.mobile}
                            error={errors.phone}
                            wrapperClassName="flex-1"
                            onChange={e => setFormData(p => ({ ...p, mobile: e.target.value.replace(/\D/g, '') }))}
                            onBlur={() => {
                                if (!formData.mobile.trim()) setErrors(p => ({ ...p, phone: 'Phone number is required.' }));
                                else setErrors(p => ({ ...p, phone: undefined }));
                            }}
                        />
                    </div>
                </div>

                {/* Travel Date + Travellers */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <Label htmlFor="peq-date">Travel Date</Label>
                        <Input
                            id="peq-date"
                            type="date"
                            min={TODAY}
                            value={formData.travelDate}
                            onChange={e => setFormData(p => ({ ...p, travelDate: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label htmlFor="peq-travellers">Travellers</Label>
                        <Input
                            id="peq-travellers"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={500}
                            placeholder="2"
                            value={formData.travellers}
                            onChange={e => setFormData(p => ({ ...p, travellers: e.target.value }))}
                        />
                    </div>
                </div>

            </div>

            {formError && (
                <p className="text-xs text-error-500 mt-3 text-center">{formError}</p>
            )}

            <Button variant="primary" className="w-full mt-4" type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending…' : 'Connect with an Expert'}
            </Button>
        </form>
    );
}
