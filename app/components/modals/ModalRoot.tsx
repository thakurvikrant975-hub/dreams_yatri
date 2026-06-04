import LoginModal from "./LogIn_Modal";
import OnBoardingModal from "./Onboarding_Modal";
import ShareModal from "./ShareModal";
import LoginPromptTrigger from "./LoginPromptTrigger";

export default function ModalRoot() {
    return (
        <>
            <LoginPromptTrigger />
            <LoginModal />
            <OnBoardingModal />
            <ShareModal />
        </>
    )
}