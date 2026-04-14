'use client'
import { useState } from 'react';
import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal_Structure';
import { useModal } from '@/app/hooks/useModals';
import Input from '../forms/Input';
import Label from '../forms/Label';
import Button from '../ui/Button';
import { Select, Option } from '../forms/Select';


function OnBoardingModal() {
    const { isOpen, type, closeModal } = useModal();

    if (!isOpen || type !== 'onboarding-modal') return null;

    return (
        <Modal
            open={isOpen}
            onClose={closeModal}
            data-layout="website"
            maxWidth='2xl'
        >
            <ModalHeader onClose={closeModal}>
                Complete Your Profile
            </ModalHeader>
            <ModalBody className='min-h-70'>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" placeholder="Enter your full name" />
                    </div>
                    <div>
                        <Label htmlFor="gender">Gender</Label>
                        <Select id="gender " placeholder="Select your gender">
                            <Option value="male">Male</Option>
                            <Option value="female">Female</Option>
                            <Option value="other">Other</Option>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="martial-status">Martial Status</Label>
                        <Select id="martial-status" placeholder="Select your martial status">
                            <Option value="married">Married</Option>
                            <Option value="single">Single</Option>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="date-of-birth">Date of Birth</Label>
                        <Input id="date-of-birth" type="date" placeholder="Select your date of birth" />
                    </div>
                    <div>

                    </div>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button onClick={closeModal} variant="primary">Save</Button>
            </ModalFooter>
        </Modal>
    )
}

export default OnBoardingModal;
