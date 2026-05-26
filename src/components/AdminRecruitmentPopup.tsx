"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { submitAdminRecruitmentResponseServerFn } from "@/services/admin.functions";
import { toast } from "sonner";

export function AdminRecruitmentPopup() {
  const { user, role, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"initial" | "form" | "confirmation">("initial");
  const [loading, setLoading] = useState(false);
  const [suggestedPassword, setSuggestedPassword] = useState("");
  const [enthusiasmMsg, setEnthusiasm] = useState("");

  const POPUP_KEY = `admin_recruitment_seen.${user?.id}`;

  useEffect(() => {
    // Only show popup to students, not admins
    if (role !== "student" || !user?.id) {
      return;
    }

    // Check if user has already seen/responded to this popup
    const hasSeen = localStorage.getItem(POPUP_KEY);
    if (!hasSeen) {
      // Show popup after a short delay for better UX
      const timer = setTimeout(() => {
        setOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [role, user?.id, POPUP_KEY]);

  const handleDecline = () => {
    // Mark as seen without recording anything
    localStorage.setItem(POPUP_KEY, "declined");
    setOpen(false);
  };

  const handleInterested = () => {
    // Move to form step
    setStep("form");
  };

  const handleSubmit = async () => {
    if (!suggestedPassword.trim() || !enthusiasmMsg.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    if (suggestedPassword.trim().length < 3) {
      toast.error("Password must be at least 3 characters");
      return;
    }

    if (enthusiasmMsg.trim().length < 10) {
      toast.error("Please share a brief message (at least 10 characters)");
      return;
    }

    setLoading(true);
    try {
      const result = await submitAdminRecruitmentResponseServerFn({
        data: {
          token: token || "",
          interested: true,
          suggestedPassword: suggestedPassword.trim(),
          enthusiasmMsg: enthusiasmMsg.trim(),
        },
      });

      // Mark as submitted
      localStorage.setItem(POPUP_KEY, "submitted");
      setStep("confirmation");

      // Auto-close after 3 seconds
      setTimeout(() => {
        setOpen(false);
      }, 3000);

      toast.success("Submitted successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit response"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!user || role !== "student") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        {step === "initial" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                Help Strengthen Our Community
              </DialogTitle>
              <DialogDescription className="mt-3 text-sm leading-relaxed">
                I created this platform to help students prepare. To make it
                better and ensure quality evaluations, I'm looking for dedicated
                admins who can:
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 px-0 py-2">
              <div className="flex gap-2 text-sm">
                <span className="text-primary font-semibold">•</span>
                <span>Review and evaluate student answers</span>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="text-primary font-semibold">•</span>
                <span>Create and manage tests</span>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="text-primary font-semibold">•</span>
                <span>Provide constructive feedback to guide learners</span>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="text-primary font-semibold">•</span>
                <span>Enhance your own skills by evaluating others</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground py-2">
              Interested admins will be evaluated and notified within 24 hours.
            </p>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleDecline}
                className="flex-1"
              >
                Not Interested
              </Button>
              <Button
                onClick={handleInterested}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                I'm Interested
              </Button>
            </div>
          </>
        )}

        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">
                Your Admin Application
              </DialogTitle>
              <DialogDescription className="text-sm">
                Share your password and tell us about your enthusiasm
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="suggestedPassword" className="text-sm">
                  Password
                </Label>
                <Input
                  id="suggestedPassword"
                  type="password"
                  placeholder="Enter a strong password"
                  value={suggestedPassword}
                  onChange={(e) => setSuggestedPassword(e.target.value)}
                  disabled={loading}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 3 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enthusiasm" className="text-sm">
                  Why do you want to be an admin?
                </Label>
                <Input
                  id="enthusiasm"
                  placeholder="Share your enthusiasm in one line..."
                  value={enthusiasmMsg}
                  onChange={(e) => setEnthusiasm(e.target.value)}
                  disabled={loading}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  How will this help you or benefit others? (minimum 10 characters)
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep("initial")}
                disabled={loading}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {loading ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </>
        )}

        {step === "confirmation" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg text-primary">
                ✓ Application Submitted
              </DialogTitle>
              <DialogDescription className="mt-3 text-sm">
                Thank you for your interest! Your application has been received.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4 px-0">
              <p className="text-sm text-muted-foreground leading-relaxed">
                I'll review your application and notify you of the decision
                within 24 hours. Once approved, you'll receive your admin
                credentials and can start helping the community.
              </p>
              <p className="text-sm font-medium text-foreground">
                Thank you for your dedication to helping others learn!
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setOpen(false)}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
