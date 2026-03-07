'use client';

import React, { useState, KeyboardEvent, forwardRef } from 'react';
import { cn } from '@/app/services/cn';
import { X } from 'lucide-react';
import { toast } from 'react-toastify';
import Tag from '../Tag';
import {  TAG_MAX_LENGTH, TAG_LIMIT } from '@/app/global';

interface TagInputProps
    extends Omit<
        React.InputHTMLAttributes<HTMLInputElement>,
        'value' | 'onChange'
    > {
    value: string[];
    onChange: (value: string[]) => void;

    error?: string;
    success?: boolean;
    message?: string;

    wrapperClassName?: string;
    inputClassName?: string;
    tagClassName?: string;

    separatorKeys?: string[];
    maxTags?: number;
    maxLength?: number;
}


const TagInput = forwardRef<HTMLInputElement, TagInputProps>((props, ref) => {
    const {
        value,
        onChange,

        error,
        success,
        message,
        wrapperClassName,
        inputClassName,
        tagClassName,

        separatorKeys = ['Enter', ','],
        maxTags = TAG_LIMIT,
        maxLength = TAG_MAX_LENGTH,
        disabled,
        placeholder = 'Add a tag',
        ...inputProps
    } = props;

    const [input, setInput] = useState('');

    const addTag = (raw: string) => {
        const trimmed = raw.trim();

        if (!trimmed) {
            toast.error('Please add some keywords in tag');
            return;
        }

        if (trimmed.length > maxLength) {
            toast.error(`Tag should be upto ${maxLength} characters`);
            return;
        }

        if (value.includes(trimmed)) {
            toast.error('You already added this tag');
            return;
        }

        if (maxTags && value.length >= maxTags) {
            toast.error(`You can add upto ${maxTags} tags only`);
            return;
        }

        onChange([...value, trimmed]);
        setInput('');
    };

    const removeTag = (tag: string) => {
        onChange(value.filter((t) => t !== tag));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (separatorKeys.includes(e.key)) {
            e.preventDefault();
            addTag(input);
        }
    };

  let inputClasses = `w-full h-10 rounded-xl px-3 py-2 text-sm placeholder:text-gray-500/80   dark:placeholder:text-zinc-500 ring-[0.09em] ring-inset outline-none border-none focus:ring-2 font-medium `;

    if (disabled) {
        inputClasses +=
            ' bg-gray-100 text-gray-500 ring-gray-300 cursor-not-allowed dark:bg-zinc-800/60 dark:ring-zinc-700';
    } else if (error) {
        inputClasses +=
            'text-error-800 dark:text-error-100 ring-error-300 focus:ring-error-400 bg-error-500/15';
    } else if (success) {
        inputClasses +=
            'ring-gray-400/60 dark:ring-zinc-600/90 focus:ring-success-400';
    } else {
        inputClasses +=
            ' bg-gray-50 text-gray-900 ring-gray-400/80 focus:ring-blue-400 dark:bg-zinc-800 dark:text-zinc-200  ring-gray-400/60 dark:ring-zinc-600/90';
    }

    return (
        <div className={cn('space-y-3', wrapperClassName)}>
            <input
                ref={ref}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => input && addTag(input)}
                disabled={disabled}
                placeholder={placeholder}
                className={cn(inputClasses, inputClassName)}
                {...inputProps}
            />

            {value.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {value.map((tag, index) => (
                        <Tag
                            as="span"
                            size="sm"
                            key={index}
                            className={cn(
                                'inline-flex items-center gap-2',
                                tagClassName
                            )}
                        >
                            {tag}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => removeTag(tag)}
                                    className="hover:text-blue-200"
                                >
                                    <X className="size-3" />
                                </button>
                            )}
                        </Tag>
                    ))}
                </div>
            )}

            {error && (
                <p className="text-error-500 text-xs font-medium">{error}</p>
            )}
            {!error && message && (
                <p className="text-gray-500 dark:text-zinc-400 text-xs font-medium">
                    {message}
                </p>
            )}
        </div>
    );
});

TagInput.displayName = 'TagInput';

export default TagInput;
