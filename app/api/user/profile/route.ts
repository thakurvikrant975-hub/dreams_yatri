import { NextRequest ,NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { Gender, MaritalStatus } from "@/app/generated/prisma";
import { success } from "zod";



// To get user data
export async function GET(req:NextRequest) {

    // Checking if user is logged in or not
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    const user = await db.user.findUnique({
        where: {id:sessionUser.id},
        select: {
            id:                     true,
            phone:                  true,
            country_code:           true,
            name:                   true,
            email:                  true,
            gender:                 true,
            dateOfBirth:            true,
            nationality:            true,
            maritalStatus:          true,
            anniversary:            true,
            state:                  true,
            city:                   true,
            passportNumber:         true,
            passportExpiryDate:     true,
            passportIssuingCountry: true,
            panNumber:              true,
            isProfileComplete:      true,
            createdAt:              true,
            updatedAt:              true,
        },
    });

    if(!user){
        return NextResponse.json({"error": "User not found"},{status: 404})
    }

    return NextResponse.json({user});
}






// To update user data
export async function PATCH(req:NextRequest) {
    // Checking if user is logged in or not
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
      const {
        name,
        email,
        gender,
        dateOfBirth,
        nationality,
        state,
        city,
        maritalStatus,
        anniversary,
        passportNumber,
        passportExpiryDate,
        passportIssuingCountry,
        panNumber,
        country_code,
    } = body;

    if(gender && !Object.values(Gender).includes(gender)){
        return NextResponse.json({error: "Invalid gender value."},{status: 400 });
    }

    if(maritalStatus && !Object.values(MaritalStatus).includes(maritalStatus)){
        return NextResponse.json({error: "Invalid marital status value."},{status: 400 });
    }

    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
        return NextResponse.json({ error: "Invalid PAN number format" }, { status: 400 });
    }

    if (anniversary && maritalStatus && maritalStatus !== MaritalStatus.MARRIED) {
        return NextResponse.json(
        { error: "Anniversary can only be set for married users." },
        { status: 400 }
        );
    }


    const data: Record<string, unknown> = {};

    if (name                    !== undefined) data.name                   = name;
    if (email                   !== undefined) data.email                  = email;
    if (gender                  !== undefined) data.gender                 = gender;
    if (nationality             !== undefined) data.nationality            = nationality;
    if (state                   !== undefined) data.state                  = state;
    if (city                    !== undefined) data.city                   = city;
    if (maritalStatus           !== undefined) data.maritalStatus          = maritalStatus;
    if (passportNumber          !== undefined) data.passportNumber         = passportNumber;
    if (passportIssuingCountry  !== undefined) data.passportIssuingCountry = passportIssuingCountry;
    if (country_code            !== undefined) data.country_code           = country_code;
    if (panNumber               !== undefined) data.panNumber              = panNumber.toUpperCase();
    if (dateOfBirth             !== undefined) data.dateOfBirth            = new Date(dateOfBirth);
    if (anniversary             !== undefined) data.anniversary            = new Date(anniversary);
    if (passportExpiryDate      !== undefined) data.passportExpiryDate     = new Date(passportExpiryDate);

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "No fields provided to update" }, { status: 400 });
    }

    const updatedUser = await db.user.update({
        where: {id: sessionUser.id},
        data,
    });

    const requiredFields = ["name", "email", "gender", "dateOfBirth","nationality", "state", "city"] as const;

    const isProfileComplete = requiredFields.every(
        (f) => updatedUser[f] !== null && updatedUser[f] !== undefined
    );

    const finalUser = await db.user.update({
        where: {id: sessionUser.id},
        data: {isProfileComplete},
        select:{
            id:                     true,
            phone:                  true,
            country_code:           true,
            name:                   true,
            email:                  true,
            gender:                 true,
            dateOfBirth:            true,
            nationality:            true,
            maritalStatus:          true,
            anniversary:            true,
            state:                  true,
            city:                   true,
            passportNumber:         true,
            passportExpiryDate:     true,
            passportIssuingCountry: true,
            panNumber:              true,
            isProfileComplete:      true,
            updatedAt:              true,
        },
    });
    return NextResponse.json({ user: finalUser });
}






// To Delete user data
export async function DELETE(req:NextRequest) {
    // Checking if user is logged in or not
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {confirmation_title} = await req.json();

    if(!confirmation_title){
        return NextResponse.json(
            {"error": "Name is required!"}, {status: 400}
        )
    }

    const user = await db.user.findUnique({
        where: {id:sessionUser.id},
        select: {name: true}
    });

    if(!user){
        return NextResponse.json({"error": "User not found"},{status: 404})
    }

    if(!user.name){
        return NextResponse.json({"error":"User has no name set. Cannot verify confirmation."},{status:400})
    }


    if(confirmation_title !== user.name.toUpperCase()){
        return NextResponse.json(
            {"error":"Type your name in capital letters to confirm."},{status: 403}
        )
    }

    await db.user.update({
        where: {id:sessionUser.id},
        data: {status: "DELETED"}
    }
    );

    return NextResponse.json(
        {success: "Account deleted successfully."},
        {status: 200}
    )
}