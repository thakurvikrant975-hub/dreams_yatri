import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { success } from "zod";

const MAX_ATTEMPTS = 3;

export async function POST(req:NextRequest) {
    const {phone, code} = await req.json();


    // Validate phone number length
    if (!phone || !code) {
        return NextResponse.json(
        { error: "Phone number or OTP is required." },
        { status: 400 }
        );
    }

    // Validate phone number length
    if (phone.length !== 10) {
    return NextResponse.json(
        { error: "Phone number must be at least 10 digits." },
        { status: 400 }
    );
    }

    // Validate OTP length
    if (code.length !== 6) {
    return NextResponse.json(
        { error: "OTP must be at least 6 digits." },
        { status: 400 }
    );
    }

    const parsedCode = parseInt(code);
    if (isNaN(parsedCode)) {
        return NextResponse.json({ error: "Invalid OTP format" }, { status: 400 });
    }

    // Finding the saved OTP from DB
    const otp = await db.otp.findFirst({
        where:{
            phone,
            usedAt: null,
            expiresAt: {gte: new Date()},
        },
        orderBy: {createdAt: "desc"}
    });

    // if OTP is not found in DB
    if(!otp){
        return NextResponse.json(
            {error: "No active OTP found. Please request a new one."},
            {status: 400}
        )
    }

    // Already hit max attempts — delete and block
    if(otp.attempts >= MAX_ATTEMPTS){
        await db.otp.delete({where:{id:otp.id}});
        return NextResponse.json(
            {error: "Too many failed attempts. Please login again."},
            {status: 429}
        )
    }

    if(otp.code!== parsedCode){
        const attemptsUsed = otp.attempts + 1;
        const remainingAttempts = MAX_ATTEMPTS - attemptsUsed;

        // incrementing attempts
        await db.otp.update({
            where: {id: otp.id},
            data: {attempts: attemptsUsed},
        });

        // on 3rd wrong attempt - delete OTP immediately
        if(remainingAttempts===0){
            await db.otp.delete({where: {id:otp.id}})
            return NextResponse.json(
                {error: "Too many failed attemps. Please login again."},
                {status: 429}
            )
        }
        return NextResponse.json({error: "Invalid OTP",remainingAttempts},{status: 401})
    }

    // If correct OTP - mark as used
    await db.otp.update({
        where: {id: otp.id},
        data: {usedAt: new Date()},
    })

    //upsert user
    const user = await db.user.upsert({
        where: {phone},
        update: {},
        create: {phone},
    })

    return NextResponse.json({
        success: true,
        user: {
            id: user.id,
            phone: user.phone,
            isProfileComplete: user.isProfileComplete,
        }
    })
    
}